/* CloseTheLoop · Configuration — proposal prototype.
   Plain JS, hash router, no build. Everything is in-memory; reload resets. */
(function () {
  'use strict';

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const S = {
    d: clone(window.SEED),
    persona: 'tech',          // tech · people · lead · global
    model: false,             // "under the hood" overlay
    sheet: null,              // {kind, ...}
    node: 'plant',            // selected tree node: plant | stage:<id> | group:<id> | eq:<id>
    treeFilter: '',
    flowSel: null,
  };
  window.__S = S;

  /* ── tiny helpers ────────────────────────────────────────────────── */
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 7);
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';
  const SEVS = ['caution', 'minor', 'major', 'emergency'];
  const SEV_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const SEV_CLOCK = { emergency: [1, 4], major: [8, 24], minor: [24, 72], caution: [null, null] };
  const TIER_LABEL = { A: 'Critical', B: 'Essential', C: 'Standard' };
  const TIER_SHARE = { A: 0.10, B: 0.20, C: 0.30 };
  const ROLE_LABEL = { l1: 'Operator', l3: 'Lead', l4: 'Senior Lead', regular: 'Client viewer', senior: 'Client viewer (senior)' };
  const GRANT_LABEL = { people: 'People Admin', tech: 'Technical Admin', fullsite: 'Full Site Admin', global: 'Global Admin' };
  const WT_LABEL = { routine: 'Routine check', pm: 'Preventive maintenance', calibration: 'Calibration', condition: 'Condition-based work' };
  const PERSONA = {
    tech: { label: 'Technical Admin', who: 'Swadesh Singh', can: { equipment: true, flows: true, people: false, site: false, standards: false, leadSheet: false } },
    people: { label: 'People Admin', who: 'Kishore Reddy', can: { equipment: false, flows: false, people: true, site: true, standards: false, leadSheet: false } },
    lead: { label: 'Lead (L3)', who: 'Kishore Reddy', can: { equipment: false, flows: false, people: false, site: false, standards: false, leadSheet: true } },
    global: { label: 'Global Admin', who: 'Alex Loijos', can: { equipment: true, flows: true, people: true, site: true, standards: true, leadSheet: false } },
  };
  const can = (k) => PERSONA[S.persona].can[k];

  const D = () => S.d;
  const eq = (id) => D().equipment.find((e) => e.id === id);
  const stage = (id) => D().stages.find((s) => s.id === id);
  const group = (id) => D().groups.find((g) => g.id === id);
  const sensor = (id) => D().sensors.find((s) => s.id === id);
  const flow = (id) => D().flows.find((f) => f.id === id);
  const cause = (id) => D().causes.find((c) => c.id === id);
  const alertById = (id) => D().alerts.find((a) => a.id === id);
  const schedById = (id) => D().schedules.find((s) => s.id === id);
  const workById = (id) => D().conditionWork.find((w) => w.id === id);

  const subjectName = (sub) => sub.kind === 'plant' ? D().plant.name : sub.kind === 'stage' ? stage(sub.id).name : sub.kind === 'group' ? group(sub.id).name : eq(sub.id).name;
  const subjectTier = (sub) => sub.kind === 'eq' ? eq(sub.id).tier : 'B';
  const subjectKey = (sub) => sub.kind === 'plant' ? 'plant' : `${sub.kind}:${sub.id}`;
  const parseNode = (key) => key === 'plant' ? { kind: 'plant' } : { kind: key.split(':')[0], id: key.split(':')[1] };
  const sensorsOf = (sub) => {
    if (sub.kind === 'eq') return D().sensors.filter((s) => s.on === 'eq:' + sub.id);
    if (sub.kind === 'group') return D().sensors.filter((s) => group(sub.id).members.includes(s.on.slice(3)));
    if (sub.kind === 'stage') return D().sensors.filter((s) => eq(s.on.slice(3)).stage === sub.id);
    return D().sensors.slice();
  };
  const sensorHome = (s) => eq(s.on.slice(3));
  const limitsOfAlert = (a) => {
    const s = sensor(a.sensor);
    const lim = a.limits === 'custom' ? a.custom : (s.limits || {});
    const dir = a.limits === 'custom' ? a.direction : s.direction;
    return { lim, dir, s };
  };
  const entrySeverity = (lim) => SEVS.find((k) => lim[k] != null) || null;   // shallowest band
  const deepestSeverity = (lim) => SEVS.slice().reverse().find((k) => lim[k] != null) || null;
  const fmtLimits = (lim, dir, unit) => {
    const parts = SEVS.filter((k) => lim && lim[k] != null).map((k) => `<span class="l ${k}">${SEV_LABEL[k]} ${dir === 'below' ? '<' : '>'} ${lim[k]}${unit ? ' ' + unit : ''}</span>`);
    return parts.length ? `<span class="limits">${parts.join('')}</span>` : '<span class="limits"><span class="none">no limits yet</span></span>';
  };
  const every = (sch) => {
    const mh = sch.meter ? sch.meter.hours : sch.meterHours;
    if (sch.basis === 'meter') return `every ${mh} run-hours`;
    if (sch.basis === 'either') return `every ${sch.every.n} ${sch.every.unit}${sch.every.n > 1 ? 's' : ''} or ${mh} run-hours, whichever first`;
    return `every ${sch.every.n === 1 ? '' : sch.every.n + ' '}${sch.every.unit}${sch.every.n > 1 ? 's' : ''}`;
  };
  const intervalHours = (sch) => {
    const u = { day: 24, week: 168, month: 720, year: 8760 }[sch.every.unit] || 24;
    return sch.every.n * u;
  };
  const taskClocks = (sch, tier) => {
    if (sch.statutory) return { deadline: 0, start: 0 };
    const h = intervalHours(sch);
    const deadline = sch.tolerance != null ? sch.tolerance * 24 : Math.max(2, h * TIER_SHARE[tier]);
    return { deadline, start: Math.max(1, deadline / 2) };
  };
  const fmtH = (h) => h == null ? '—' : h === 0 ? 'at once' : h >= 48 ? `${Math.round(h / 24 * 10) / 10} days` : h >= 24 ? `${Math.round(h / 24 * 10) / 10} day` : `${Math.round(h * 10) / 10} h`;

  /* roster resolution — who is told, from the brief's tables */
  const people = () => D().people;
  const names = (list) => list.map((p) => `<span class="nm">${esc(p.name.split(' ')[0])}</span>`).join(', ') || '<i class="muted">nobody</i>';
  const byRole = (r) => people().filter((p) => p.role === r);
  const ops = () => byRole('l1'), leads = () => byRole('l3'), seniors = () => byRole('l4'), clients = () => byRole('regular');
  const seniorOrLeads = () => seniors().length ? seniors() : leads();
  const siteAdmins = () => people().filter((p) => p.grant === 'people' || p.grant === 'fullsite');

  function issueLadder(sev, clocks) {
    const [resp, dead] = clocks || SEV_CLOCK[sev];
    if (sev === 'emergency') return [
      ['Now', `${names(ops())} · ${names(leads())} · ${names(seniors())} — phone call, hooter, full-screen alarm`],
      [`Not started in ${fmtH(resp)}`, `${names(leads())} · ${names(seniors())} again`],
      [`Not fixed in ${fmtH(dead)}`, `${names(ops())} · ${names(leads())} again · Site Admin (${names(siteAdmins())}) by email`],
    ];
    if (sev === 'major') return [
      ['Now', `${names(ops())} · ${names(leads())} — WhatsApp and full-screen alarm`],
      [`Not started in ${fmtH(resp)}`, names(leads())],
      [`Not fixed in ${fmtH(dead)}`, `${names(seniorOrLeads())} · Site Admin and client informed by email`],
    ];
    if (sev === 'minor') return [
      ['Now', `${names(ops())} — WhatsApp · ${names(leads())} in the app and the morning email`],
      [`Not started in ${fmtH(resp)}`, names(leads())],
      [`Not fixed in ${fmtH(dead)}`, `${names(seniorOrLeads())} · Site Admin and client informed by email`],
    ];
    return [['Now', `${names(ops())} · ${names(leads())} — in the app and the morning email`], ['Later', 'Nothing. Caution never reminds.']];
  }
  function taskLadder(sch, tier) {
    const c = taskClocks(sch, tier);
    const loud = (tier === 'A' || sch.statutory);
    return [
      ['When due', `${names(ops())} — in the app and the morning email${sch.basis !== 'condition' ? ' · claimable 3 days before' : ''}`],
      [`Not started in ${fmtH(c.start)}`, loud ? `${names(ops())} — WhatsApp` : `${names(ops())} — in the app`],
      [`Overdue after ${fmtH(c.deadline)}`, `${names(ops())} · ${names(leads())} — WhatsApp${loud ? ` · ${names(seniors())}` : ''}`],
      [`Twice overdue`, `${names(ops())} · ${names(leads())} · ${names(seniors())} — WhatsApp · Site Admin by email`],
    ];
  }
  const toldBlock = (rows) => `<div class="told">${rows.map(([w, p]) => `<div class="r"><div class="w">${esc(w)}</div><div class="p">${p}</div></div>`).join('')}</div>`;

  /* readiness computations */
  const gaps = () => {
    const d = D();
    const sensorsNoLimits = d.sensors.filter((s) => s.kind !== 'meter' && s.kind !== 'status' && (!s.limits || !SEVS.some((k) => s.limits[k] != null)));
    const eqNeedingPM = d.equipment.filter((e) => e.expects.some((x) => /PM|CIP|inspection|refill|backwash|cleaning/.test(x)) && !d.schedules.some((s) => s.subject.kind === 'eq' && s.subject.id === e.id && (s.workType === 'pm' || s.workType === 'routine')) && !d.conditionWork.some((w) => w.subject.id === e.id));
    const probesNoCal = d.sensors.filter((s) => s.kind === 'analytical' && !d.schedules.some((x) => x.workType === 'calibration' && x.probe === s.id));
    const eqNoAlerts = d.equipment.filter((e) => d.standardSets.some((t) => t.type === e.type && t.alerts.length) && !d.alerts.some((a) => a.subject.kind === 'eq' && a.subject.id === e.id) && !d.alerts.some((a) => sensorHome(sensor(a.sensor)).id === e.id));
    const causesNoFix = d.causes.filter((c) => !c.fix && !c.sensorFault);
    const flowsUnused = d.flows.filter((f) => f.status === 'published' && !d.alerts.some((a) => a.flow === f.id) && !d.schedules.some((s) => s.flow === f.id) && !d.conditionWork.some((w) => w.flow === f.id) && !d.causes.some((c) => c.fix === f.id));
    const reachOps = ops().filter((p) => p.phone.verified), reachLeads = leads().filter((p) => p.phone.verified);
    const majorNow = ops().some((p) => p.major === 'now') && leads().some((p) => p.major === 'now');
    const routingOk = reachOps.length > 0 && reachLeads.length > 0 && majorNow;
    let routingWhy = '';
    if (!reachOps.length) routingWhy = 'No Operator with a verified phone.';
    else if (!reachLeads.length) routingWhy = 'No Lead with a verified phone.';
    else if (!majorNow) routingWhy = 'Nobody at the plant has Major set to Now.';
    return { sensorsNoLimits, eqNeedingPM, probesNoCal, eqNoAlerts, causesNoFix, flowsUnused, routingOk, routingWhy, reachOps, reachLeads };
  };

  /* ── toast, modal, sheet ─────────────────────────────────────────── */
  let toastT;
  function toast(msg, undo) {
    $('#toast')?.remove();
    const el = document.createElement('div'); el.className = 'toast'; el.id = 'toast';
    el.innerHTML = `<span>${msg}</span>${undo ? '<span class="u">Undo</span>' : ''}`;
    if (undo) el.querySelector('.u').onclick = () => { undo(); el.remove(); render(); };
    document.body.appendChild(el);
    clearTimeout(toastT); toastT = setTimeout(() => el.remove(), 6000);
  }
  function audit(what, detail) {
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    D().audit.unshift({ ts, who: PERSONA[S.persona].who, what, detail });
  }
  function openSheet(sheet) { S.sheet = sheet; renderSheet(); }
  function closeSheet() { S.sheet = null; renderSheet(); }
  function modal(title, body, actions) {
    $('#modal')?.remove();
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
    m.innerHTML = `<div class="box"><div class="h">${esc(title)}</div><div class="b">${body}</div><div class="ft">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(m);
    $$('.ft button', m).forEach((b) => b.onclick = () => { const a = actions[+b.dataset.i]; const keep = a.fn && a.fn(m); if (!keep) m.remove(); });
    return m;
  }

  /* ── router ──────────────────────────────────────────────────────── */
  function route() {
    const h = location.hash.replace(/^#\/?/, '') || 'setup';
    const [view, ...rest] = h.split('/');
    return { view, rest };
  }
  window.addEventListener('hashchange', () => { S.sheet = null; render(); });

  /* ── shell ───────────────────────────────────────────────────────── */
  function renderNav() {
    const { view } = route();
    const g = gaps();
    const items = [
      ['setup', 'Plant setup', g.routingOk ? '' : 'err', 'ic-home'],
      ['equipment', 'Equipment', (g.sensorsNoLimits.length + g.eqNeedingPM.length + g.probesNoCal.length + g.eqNoAlerts.length) ? 'gap' : '', 'ic-eq'],
      ['flows', 'Flows', g.causesNoFix.length ? 'gap' : '', 'ic-flow'],
      ['people', 'People & alerts', g.routingOk ? '' : 'err', 'ic-people'],
      ['activity', 'Activity', '', 'ic-log'],
    ];
    if (can('standards')) items.splice(3, 0, ['standards', 'Standard sets', '', 'ic-lib']);
    $('#nav').innerHTML = `
      <div class="eyebrow">${esc(D().plant.name)}</div>
      ${items.map(([r, l, dot]) => `<a class="item ${view === r ? 'active' : ''}" href="#/${r}">${l}${dot ? `<span class="dot" style="${dot === 'err' ? 'background:var(--sev-emergency)' : ''}"></span>` : ''}</a>`).join('')}
      <div class="foot">
        Signed in as <b>${esc(PERSONA[S.persona].who)}</b><br>${esc(PERSONA[S.persona].label)}
        <label><input type="checkbox" id="modelToggle" ${S.model ? 'checked' : ''}> Show the model underneath</label>
        <div style="margin-top:8px"><a href="index.html">← Read the proposal</a></div>
      </div>`;
    $('#modelToggle').onchange = (e) => { S.model = e.target.checked; document.body.classList.toggle('model', S.model); };
    $('#persona').value = S.persona;
    $('#crumb').innerHTML = `<b>${esc(D().plant.name)}</b> · ${esc(D().plant.code)}`;
  }

  function render() {
    document.body.classList.toggle('model', S.model);
    renderNav();
    const { view, rest } = route();
    const main = $('#main');
    const fn = { setup: vSetup, equipment: vEquipment, flows: vFlows, people: vPeople, activity: vActivity, standards: vStandards }[view] || vSetup;
    main.innerHTML = fn(rest);
    wire(view, rest);
    renderSheet();
    window.scrollTo({ top: 0 });
  }

  /* ── view: plant setup (readiness) ───────────────────────────────── */
  function vSetup() {
    const g = gaps(), d = D();
    const row = (ok, t, s, href, cta) => `<div class="item"><div class="st ${ok === true ? 'ok' : ok === 'err' ? 'err' : 'todo'}">${ok === true ? '✓' : ok === 'err' ? '!' : '•'}</div><div><div class="t">${t}</div><div class="s">${s}</div></div><div>${href ? `<a class="btn sm" href="${href}">${cta || 'Open'}</a>` : ''}</div></div>`;
    const active = d.alerts.filter((a) => a.status === 'active').length;
    const schedules = d.schedules.filter((s) => s.status === 'active').length + d.conditionWork.length;
    return `
      <div class="pagehead"><div class="grow"><h1>Is ${esc(d.plant.name)} ready?</h1>
        <p class="lede">One screen answers whether an alert will reach a person, whether every machine is watched, and whether every machine that needs a schedule has one. Everything else is detail.</p></div></div>

      <div class="health ${g.routingOk ? 'ok' : 'err'}"><div class="ic">${g.routingOk ? '✓' : '!'}</div>
        <div><b>${g.routingOk ? 'Alerts will reach a human' : 'Alerts may reach nobody'}</b>
        <p>${g.routingOk ? `${plural(g.reachOps.length, 'Operator')} and ${plural(g.reachLeads.length, 'Lead')} have verified phones. Who is told is fixed by role; there is nothing to draw.` : esc(g.routingWhy) + ' Fix it in People & alerts.'}</p></div></div>

      <div class="kpis" style="margin-top:16px">
        <div class="kpi"><div class="v">${d.equipment.length}</div><div class="l">machines in ${d.stages.length} stages</div></div>
        <div class="kpi"><div class="v">${active}</div><div class="l">alerts watching the plant</div></div>
        <div class="kpi"><div class="v">${schedules}</div><div class="l">schedules and condition-based jobs</div></div>
        <div class="kpi"><div class="v">${d.flows.filter((f) => f.status === 'published').length}</div><div class="l">published flows</div></div>
      </div>

      <div class="card" style="margin-top:16px"><div class="hd"><h2>Setup checklist</h2><span class="hint">Green means done. Anything else links to the place that fixes it.</span></div>
        <div class="bd tight ready">
          ${row(g.reachOps.length && g.reachLeads.length ? true : 'err', 'People who can be reached', g.reachOps.length && g.reachLeads.length ? `${plural(ops().length, 'Operator')}, ${plural(leads().length, 'Lead')}, ${plural(seniors().length, 'Senior Lead')} on the roster.` : g.routingWhy, '#/people', 'People')}
          ${row(!g.sensorsNoLimits.length, 'Every sensor has limits', g.sensorsNoLimits.length ? `${plural(g.sensorsNoLimits.length, 'sensor')} without limits: ${g.sensorsNoLimits.map((s) => esc(s.name + ' on ' + sensorHome(s).tag)).join(', ')}.` : `All ${d.sensors.filter((s) => s.kind !== 'meter' && s.kind !== 'status').length} process sensors carry limits.`, g.sensorsNoLimits.length ? `#/equipment/eq:${sensorHome(g.sensorsNoLimits[0]).id}` : null, 'Set limits')}
          ${row(!g.eqNoAlerts.length, 'Every machine with a standard set is watched', g.eqNoAlerts.length ? `${g.eqNoAlerts.map((e) => esc(e.name)).join(', ')} ${g.eqNoAlerts.length === 1 ? 'has' : 'have'} a standard set that is not added yet.` : 'Nothing recommended is missing.', g.eqNoAlerts.length ? `#/equipment/eq:${g.eqNoAlerts[0].id}` : null, 'Review')}
          ${row(!g.eqNeedingPM.length, 'Every machine that needs a schedule has one', g.eqNeedingPM.length ? `${g.eqNeedingPM.map((e) => esc(e.name)).join(', ')}: ${g.eqNeedingPM.length === 1 ? 'its type expects' : 'their types expect'} ${[...new Set(g.eqNeedingPM.flatMap((e) => e.expects))].join(', ')}.` : `${d.equipment.length} of ${d.equipment.length} machines have a maintenance programme.`, g.eqNeedingPM.length ? `#/equipment/eq:${g.eqNeedingPM[0].id}` : null, 'Add schedule')}
          ${row(!g.probesNoCal.length, 'Every probe has a calibration schedule', g.probesNoCal.length ? `${plural(g.probesNoCal.length, 'probe')} not calibrated on a schedule: ${g.probesNoCal.map((s) => esc(s.name + ' on ' + sensorHome(s).tag)).join(', ')}.` : 'All probes are on a calibration schedule.', g.probesNoCal.length ? `#/equipment/eq:${sensorHome(g.probesNoCal[0]).id}` : null, 'Add calibration')}
          ${row(!g.causesNoFix.length, 'Every diagnosis leads to a fix', g.causesNoFix.length ? `${plural(g.causesNoFix.length, 'cause')} with no action flow: ${g.causesNoFix.map((c) => esc(c.name)).join(', ')}. An operator who reaches one is told what is wrong and nothing about what to do.` : 'Every cause has an action flow.', '#/flows/causes', 'Link fixes')}
          ${row(true, 'Site defaults', `Quiet hours ${d.plant.quietHours.from}–${d.plant.quietHours.to} for Minor and Caution · hooter ${d.plant.hooter.on ? 'on, ' + d.plant.hooter.seconds + ' s' : 'off'}.`, '#/people', 'Change')}
        </div></div>

      <div class="card"><div class="hd"><h2>Recent changes</h2><a class="btn sm" href="#/activity">All activity</a></div>
        <div class="bd tight audit">${d.audit.slice(0, 4).map((a) => `<div class="r"><div class="w">${esc(a.ts)}</div><div><div>${esc(a.what)} <span class="muted">— ${esc(a.who)}</span></div><div class="b">${esc(a.detail)}</div></div></div>`).join('')}</div></div>`;
  }

  /* ── view: equipment (tree + node page) ──────────────────────────── */
  function vEquipment(rest) {
    if (rest[0]) S.node = decodeURIComponent(rest[0]);
    const sub = parseNode(S.node);
    return `<div class="split">${vTree()}<div>${vNode(sub)}</div></div>`;
  }
  function vTree() {
    const d = D(), g = gaps(), q = S.treeFilter.toLowerCase();
    const eqGap = (e) => g.eqNeedingPM.includes(e) || g.eqNoAlerts.includes(e) || g.sensorsNoLimits.some((s) => s.on === 'eq:' + e.id) || g.probesNoCal.some((s) => s.on === 'eq:' + e.id);
    const countFor = (sub) => {
      const a = d.alerts.filter((x) => subjectKey(x.subject) === subjectKey(sub)).length;
      const s = d.schedules.filter((x) => subjectKey(x.subject) === subjectKey(sub)).length + d.conditionWork.filter((x) => subjectKey(x.subject) === subjectKey(sub)).length;
      return (a || s) ? `${a ? a + 'A' : ''}${a && s ? ' · ' : ''}${s ? s + 'S' : ''}` : '';
    };
    const node = (key, cls, label, extra = '', gap = false) => `<div class="node ${cls} ${S.node === key ? 'sel' : ''}" data-node="${key}"><span>${esc(label)}</span>${gap ? '<span class="gap" title="Something is missing here"></span>' : ''}<span class="n">${extra}</span></div>`;
    let html = `<div class="search"><input placeholder="Find a machine or sensor" value="${esc(S.treeFilter)}" id="treeq"></div>`;
    html += node('plant', 'plant', d.plant.name, countFor({ kind: 'plant' }));
    d.stages.forEach((st) => {
      const eqs = d.equipment.filter((e) => e.stage === st.id && (!q || e.name.toLowerCase().includes(q) || e.tag.toLowerCase().includes(q) || d.sensors.some((s) => s.on === 'eq:' + e.id && s.name.toLowerCase().includes(q))));
      if (q && !eqs.length && !st.name.toLowerCase().includes(q)) return;
      html += node('stage:' + st.id, 'stage', st.name, countFor({ kind: 'stage', id: st.id }), eqs.some(eqGap));
      const grouped = new Set();
      d.groups.filter((gr) => gr.stage === st.id).forEach((gr) => {
        const members = eqs.filter((e) => gr.members.includes(e.id));
        if (!members.length) return;
        html += node('group:' + gr.id, 'eq', gr.name + ' (group)', countFor({ kind: 'group', id: gr.id }), members.some(eqGap));
        members.forEach((e) => { grouped.add(e.id); html += node('eq:' + e.id, 'eq', '   ' + e.name, countFor({ kind: 'eq', id: e.id }) || `<span class="sens">${d.sensors.filter((s) => s.on === 'eq:' + e.id).length} sensors</span>`, eqGap(e)); });
      });
      eqs.filter((e) => !grouped.has(e.id)).forEach((e) => html += node('eq:' + e.id, 'eq', e.name, countFor({ kind: 'eq', id: e.id }) || `<span class="sens">${d.sensors.filter((s) => s.on === 'eq:' + e.id).length} sensors</span>`, eqGap(e)));
    });
    return `<div class="tree">${html}</div>`;
  }

  function vNode(sub) {
    const d = D();
    const alerts = d.alerts.filter((a) => subjectKey(a.subject) === subjectKey(sub));
    const schedules = d.schedules.filter((s) => subjectKey(s.subject) === subjectKey(sub));
    const work = d.conditionWork.filter((w) => subjectKey(w.subject) === subjectKey(sub));
    const sens = sensorsOf(sub);
    const g = gaps();
    const readOnly = !can('equipment');
    const leadNote = S.persona === 'lead' ? `<div class="note teal persona-note"><span>As a Lead you can change the cadence of in-house preventive maintenance from here. Everything else is read-only — the same schedule, the same audit trail, edited from the card instead of the console.</span></div>` : readOnly ? `<div class="note persona-note"><span>Read-only for ${esc(PERSONA[S.persona].label)}. A Technical Admin configures equipment.</span></div>` : '';

    /* header */
    let head = '';
    if (sub.kind === 'eq') {
      const e = eq(sub.id), st = stage(e.stage);
      head = `<div class="eqhead"><div class="grow"><div class="crumb">${esc(d.plant.name)} › ${esc(st.name)}${e.group ? ' › ' + esc(group(e.group).name) : ''}</div>
        <h1>${esc(e.name)} <span class="muted mono" style="font-weight:500">${esc(e.tag)}</span></h1>
        <div class="meta"><span class="chip">${esc(e.type)}</span><span class="tier ${e.tier}" title="Criticality tier — derived from what a failure costs; a Technical Admin may override it with a reason">${e.tier} · ${TIER_LABEL[e.tier]}</span>${e.duty ? `<span class="chip">${esc(cap(e.duty))}${e.standbyOf ? ' of ' + esc(eq(e.standbyOf).tag) : ''}</span>` : ''}<span class="chip ${e.status === 'running' ? 'ok' : e.status === 'maintenance' ? 'warn' : ''}">${esc(cap(e.status))}</span>
        <span class="model-pill">Equipment · archetype ${esc(e.archetype)} · criticalityTier ${e.tier}</span></div></div>
        ${readOnly ? '' : `<div class="actions"><button class="btn primary" id="addMenu">Add <span class="caret">▾</span></button></div>`}</div>`;
    } else if (sub.kind === 'stage') {
      const st = stage(sub.id);
      head = `<div class="eqhead"><div class="grow"><div class="crumb">${esc(d.plant.name)}</div><h1>${esc(st.name)}</h1>
        <div class="meta"><span class="chip">Stage · ${plural(d.equipment.filter((e) => e.stage === st.id).length, 'machine')}</span><span class="tier B">B · Essential</span><span class="model-pill">Subject kind unitProcess</span></div>
        <p class="lede muted" style="margin-top:8px">Alerts here are about the stage, not any one machine — DO across the basin, a step running slow. No machine carries them until somebody finds the cause.</p></div>
        ${readOnly ? '' : `<div class="actions"><button class="btn primary" id="addMenu">Add <span class="caret">▾</span></button></div>`}</div>`;
    } else if (sub.kind === 'group') {
      const gr = group(sub.id);
      head = `<div class="eqhead"><div class="grow"><div class="crumb">${esc(d.plant.name)} › ${esc(stage(gr.stage).name)}</div><h1>${esc(gr.name)}</h1>
        <div class="meta"><span class="chip">Group · ${gr.members.map((m) => esc(eq(m).tag)).join(', ')}</span><span class="chip">${esc(gr.note)}</span></div>
        <p class="lede muted" style="margin-top:8px">Work about the set rather than one member: duty changeover, spread of run-hours, total delivered air.</p></div>
        ${readOnly ? '' : `<div class="actions"><button class="btn primary" id="addMenu">Add <span class="caret">▾</span></button></div>`}</div>`;
    } else {
      head = `<div class="eqhead"><div class="grow"><h1>${esc(d.plant.name)}</h1>
        <div class="meta"><span class="chip">Whole plant · ${esc(d.plant.capacity)}</span><span class="chip">${d.stages.length} stages · ${d.equipment.length} machines</span></div>
        <p class="lede muted" style="margin-top:8px">Rounds, compliance sampling, housekeeping and plant-wide alerts live here. They count against no machine and no stage.</p></div>
        ${readOnly ? '' : `<div class="actions"><button class="btn primary" id="addMenu">Add <span class="caret">▾</span></button></div>`}</div>`;
    }

    /* recommended standard set */
    let reco = '';
    if (sub.kind === 'eq' && !readOnly) {
      const e = eq(sub.id), t = d.standardSets.find((x) => x.type === e.type);
      if (t) {
        const missingA = t.alerts.filter((ta) => !alerts.some((a) => a.template === t.id.slice(2) && a.name.startsWith(ta.name.split(' —')[0])) && !alerts.some((a) => sensor(a.sensor).name === ta.sensorKind));
        const missingS = t.schedules.filter((ts) => !schedules.some((s) => s.name === ts.name) && !work.some((w) => w.name === ts.name));
        if (missingA.length || missingS.length) reco = `<div class="reco"><div class="grow"><div class="t">Standard set for ${esc(e.type)} — ${[missingA.length ? plural(missingA.length, 'alert') : '', missingS.length ? plural(missingS.length, 'schedule') : ''].filter(Boolean).join(' and ')} not added yet</div><div class="s">Used at ${t.usedAt} plants. Adds as drafts bound to ${esc(e.tag)} so you check the numbers against this machine before anything fires.</div></div><button class="btn teal" id="reviewSet" data-t="${t.id}">Review and add</button></div>`;
      }
    }

    /* sensors */
    const sensorRows = sens.map((s) => {
      const home = sensorHome(s);
      const used = d.alerts.filter((a) => a.sensor === s.id).length + d.conditionWork.filter((w) => w.sensor === s.id).length;
      const cal = d.schedules.find((x) => x.workType === 'calibration' && x.probe === s.id);
      const stateChip = s.state === 'stale' ? '<span class="chip warn">Stale</span>' : s.state === 'not_trusted' ? '<span class="chip err">Not trusted · alerts paused</span>' : '';
      return `<tr class="click" data-sensor="${s.id}"><td><b>${esc(s.name)}</b> <span class="muted mono">${esc(s.tag)}</span>${sub.kind !== 'eq' ? `<div class="small muted">on ${esc(home.name)}</div>` : ''}${s.kind === 'computed' ? `<div class="small muted mono">${esc(s.expr)}</div>` : ''}</td>
        <td class="reading">${s.kind === 'status' ? (s.reading ? 'ON' : 'OFF') : s.reading}<span class="u">${esc(s.unit)}</span> ${stateChip}</td>
        <td>${s.kind === 'meter' ? '<span class="muted small">meter — drives schedules, not alerts</span>' : s.kind === 'status' ? fmtLimits(s.limits, 'above', '') : fmtLimits(s.limits, s.direction, s.unit)}${s.setpoint ? `<div class="small muted">PLC set point ${s.setpoint.value} ${esc(s.unit)}</div>` : ''}</td>
        <td class="small muted">${used ? plural(used, 'alert') : (s.kind === 'meter' ? '' : '—')}${s.kind === 'analytical' ? (cal ? '<br>calibrated ' + esc(every(cal)) : '<br><span style="color:#8a5000">no calibration schedule</span>') : ''}</td></tr>`;
    }).join('');

    /* alerts */
    const alertCards = alerts.map((a) => {
      const { lim, dir, s } = limitsOfAlert(a);
      const entry = entrySeverity(lim), deep = deepestSeverity(lim);
      const sevChips = SEVS.filter((k) => lim[k] != null).map((k) => `<span class="sev ${k}">${SEV_LABEL[k]}</span>`).join(' ');
      const closes = a.closes.mode === 'sensor' ? `closes when ${esc(s.name)} is back ${dir === 'below' ? 'above' : 'below'} ${a.closes.back} ${esc(s.unit)} for ${a.closes.holdMin} min` : 'closes when the operator declares it fixed with a photo or note';
      const does = a.flow ? `opens <b>${esc(flow(a.flow).name)}</b>` : a.cause ? `opens at the fix for <b>${esc(cause(a.cause).name)}</b>` : 'no flow — operator closes with proof';
      const ladder = issueLadder(entry || 'minor', a.clocks ? [a.clocks.response, a.clocks.deadline] : null);
      return `<div class="item-card" data-alert="${a.id}"><div><div class="t">${esc(a.name)} ${sevChips}${a.open ? `<span class="chip warn">${plural(a.open, 'open record')} · terms frozen</span>` : ''}${a.cycle ? `<span class="chip info">only during ${esc(a.cycle.only)}</span>` : ''}${a.pairOf ? '<span class="chip">paired</span>' : ''}${a.clocks ? '<span class="chip">custom clocks</span>' : ''}</div>
        <div class="s">${esc(s.name)} ${dir === 'below' ? 'falls below' : 'rises above'} ${lim[entry]} ${esc(s.unit)}${a.holdMin ? ' for ' + a.holdMin + ' min' : ''}${sub.kind !== 'eq' ? ' · read on ' + esc(sensorHome(s).tag) : ''} · ${closes} · ${does}${a.verify ? ' · Lead verifies' : ''}</div>
        <div class="who">Told now: ${ladder[0][1].replace(/<[^>]+>/g, '')}${entry !== deep ? ` · gets louder at ${SEV_LABEL[deep]}` : ''}</div></div>
        <div class="r"><span class="chip ${a.status === 'active' ? 'ok' : a.status === 'draft' ? 'draft' : ''}">${cap(a.status)}</span></div>
        <div class="model">Trigger · outcome issue · triggerType alert · ${SEVS.filter((k) => lim[k] != null).length} severityBands${a.limits === 'sensor' ? ' · inheritsSensorZones true' : ''} · resolutionType ${a.closes.mode === 'sensor' ? 'condition' : 'manual'} · subject ${subjectKey(a.subject)}${a.flow ? ' · procedureTreeId ' + a.flow : ''}</div></div>`;
    }).join('');

    /* schedules */
    const schedCards = schedules.map((sc) => {
      const tier = sc.statutory ? 'A' : subjectTier(sc.subject);
      const c = taskClocks(sc, tier);
      const chip = sc.workType === 'pm' ? '<span class="chip teal">Preventive</span>' : sc.workType === 'calibration' ? '<span class="chip info">Calibration</span>' : '<span class="chip">Routine</span>';
      const leadEditable = S.persona === 'lead' && sc.workType === 'pm' && sc.performedBy !== 'vendor';
      return `<div class="item-card" data-sched="${sc.id}"><div><div class="t">${esc(sc.name)} ${chip}${sc.statutory ? '<span class="chip navy">§ Statutory</span>' : ''}${sc.performedBy === 'vendor' ? `<span class="chip">Vendor · ${esc(sc.vendor || '')}</span>` : ''}${sc.open ? `<span class="chip warn">${plural(sc.open, 'open occurrence')}</span>` : ''}${leadEditable ? '<span class="chip ok">You can edit cadence</span>' : ''}</div>
        <div class="s">${cap(every(sc))}${sc.basis !== 'meter' ? (sc.anchor === 'last' ? ', counted from the last completion' : ', on fixed dates') : ''} · next due ${esc(sc.nextDue)} · ${sc.flow ? `runs <b>${esc(flow(sc.flow).name)}</b>` : 'simple checklist'}${sc.probe ? ` · probe ${esc(sensor(sc.probe).name)}` : ''}${sc.verify ? ' · Lead signs off' : ''}</div>
        <div class="who">Must start within ${fmtH(c.start)}, finish within ${fmtH(c.deadline)} — from ${sc.statutory ? 'statutory (no tolerance)' : `tier ${tier} and cadence`}</div></div>
        <div class="r"><span class="chip ${sc.status === 'active' ? 'ok' : 'draft'}">${cap(sc.status)}</span></div>
        <div class="model">Trigger · outcome task · triggerType schedule · workType ${sc.workType === 'pm' ? 'preventive_maintenance' : sc.workType === 'calibration' ? 'calibration' : 'routine_check'} · dueBasis ${sc.basis} · calendarAnchor ${sc.anchor === 'last' ? 'from_last_service' : 'fixed'} · performedBy ${sc.performedBy}${sc.statutory ? ' · statutory' : ''}</div></div>`;
    }).join('');

    const workCards = work.map((w) => {
      const s = sensor(w.sensor);
      return `<div class="item-card" data-work="${w.id}"><div><div class="t">${esc(w.name)} <span class="chip">Condition-based</span>${w.escalate ? '<span class="chip">escalates</span>' : ''}</div>
        <div class="s">Do it when ${esc(s.name)} goes above ${w.doWhen} ${esc(s.unit)} · done when back below ${w.doneWhen} ${esc(s.unit)} · runs <b>${esc(flow(w.flow).name)}</b>${w.escalate ? ` · raises a <b>${SEV_LABEL[w.escalate.severity]}</b> issue above ${w.escalate.at} ${esc(s.unit)}` : ''}</div>
        <div class="who">Asked once per rise; if ignored 5 times in a row the Lead gets one issue about this rule</div></div>
        <div class="r"><span class="chip ok">${cap(w.status)}</span></div>
        <div class="model">Trigger · outcome task · triggerType alert (routine) · rearmConditionId · chronicIgnoreThreshold 5${w.escalate ? ' · promotionPairOf ' + w.escalate.alert : ''}</div></div>`;
    }).join('');

    const e = sub.kind === 'eq' ? eq(sub.id) : null;
    const pmGap = e && g.eqNeedingPM.includes(e) ? `<div class="note warn" style="margin-bottom:8px"><span><b>No maintenance schedule.</b> A ${esc(e.type.toLowerCase())} usually needs ${esc(e.expects.join(' and '))}. ${readOnly ? '' : 'Add one, or add the standard set above.'}</span></div>` : '';
    const cycles = e && e.cycles ? `<div class="section"><div class="sh"><h2>Cycles</h2><span class="hint">Automated cycles this machine runs. Alerts can be limited to a phase and close at the cycle boundary.</span></div>
      ${d.cycles.filter((c) => c.eq === e.id).map((c) => `<div class="item-card"><div><div class="t">${esc(c.name)}</div><div class="s">${c.phases.map((p) => `${esc(p.name)} ${p.minutes} min${p.kind === 'sensor' ? ' (valve-driven)' : ''}`).join(' → ')} · ${c.phases.reduce((n, p) => n + p.minutes, 0)} min per cycle</div><div class="who">Skipped or overrun cycles raise their own issue. Feeds the equipment history as one event per cycle.</div></div><div class="r"><span class="chip ok">Tracked</span></div><div class="model">Cycle → Events/Batch entity · phase-aware conditions · closeReason cycle_complete (observed)</div></div>`).join('')}</div>` : '';
    const details = sub.kind === 'eq' ? `<div class="section"><div class="sh"><h2>Details</h2></div><div class="card"><div class="bd" style="display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;font-size:13px">
        <div><div class="small muted">Criticality</div><b>${e.tier} · ${TIER_LABEL[e.tier]}</b> <span class="muted">— derived from what a failure costs${e.standbyOf ? '; one tier lower because ' + esc(eq(e.standbyOf).tag) + ' covers it' : ''}</span> ${readOnly ? '' : '<a href="#" data-override>Override</a>'}</div>
        <div><div class="small muted">Type and archetype</div><b>${esc(e.type)}</b> <span class="muted">· ${esc(e.archetype)} — expects ${esc(e.expects.join(', ') || 'no maintenance programme')}</span></div>
        <div><div class="small muted">Standby relation</div>${e.duty ? `<b>${cap(e.duty)}</b>${e.standbyOf ? ' of ' + esc(eq(e.standbyOf).name) : ''} <span class="muted">— a standby rises one tier while its duty unit is down</span>` : '<span class="muted">none</span>'}</div>
        <div><div class="small muted">Maintenance mode</div><span class="muted">Set from the equipment card by a Lead or Operator; pauses every alert on this machine and its sensors while it is off-line.</span></div>
      </div></div></div>` : '';
    const milestones = sub.kind === 'plant' ? `<div class="section"><div class="sh"><h2>Milestones</h2><span class="hint">Good news, counted on Plant Home. Never notifies anyone.</span>${readOnly ? '' : '<button class="btn sm" id="addMilestone">Add milestone</button>'}</div>
      ${d.milestones.map((m) => `<div class="item-card"><div><div class="t">${esc(m.name)}</div><div class="s">${m.on ? 'Detected from ' + esc(sensor(m.on).name) : 'Detected from records'} · recorded ${m.count} times</div></div><div class="r"><span class="chip ok">Active</span></div><div class="model">Trigger · outcome achievement · state RECORDED · in-app counter only</div></div>`).join('')}</div>` : '';

    return `${leadNote}${head}${reco}
      ${sens.length ? `<div class="section"><div class="sh"><h2>Sensors and limits</h2><span class="hint">Limits live on the sensor. Alerts use them unless told otherwise. ${readOnly ? '' : 'Click a row to edit.'}</span></div>
        <div class="card"><div class="bd tight"><table class="tbl"><thead><tr><th>Sensor</th><th>Reading</th><th>Limits</th><th>Used by</th></tr></thead><tbody>${sensorRows}</tbody></table></div></div></div>` : ''}
      <div class="section"><div class="sh"><h2>Alerts</h2><span class="hint">Something is wrong — someone must fix it. Severity and who is told follow from the limit crossed.</span>${readOnly ? '' : '<button class="btn sm" id="addAlert">Add alert</button>'}</div>
        ${alertCards || '<div class="card"><div class="empty"><b>No alerts here yet</b>Nothing about this ' + (sub.kind === 'eq' ? 'machine' : sub.kind) + ' is being watched.</div></div>'}</div>
      <div class="section"><div class="sh"><h2>Schedules</h2><span class="hint">Planned work — routine checks, preventive maintenance, calibration. Clocks follow from criticality and cadence.</span>${readOnly ? '' : '<button class="btn sm" id="addSched">Add schedule</button>'}</div>
        ${pmGap}${schedCards || '<div class="card"><div class="empty"><b>No schedules here yet</b></div></div>'}</div>
      ${(work.length || (sub.kind === 'eq' && sens.some((s) => s.kind === 'process' || s.kind === 'computed'))) ? `<div class="section"><div class="sh"><h2>Condition-based work</h2><span class="hint">The plant asks for a job when a reading crosses a line — a backwash, a filter clean. Working as designed, not a fault.</span>${readOnly ? '' : '<button class="btn sm" id="addWork">Add condition-based work</button>'}</div>
        ${workCards || '<div class="card"><div class="empty"><b>None yet</b></div></div>'}</div>` : ''}
      ${cycles}${milestones}${details}`;
  }

  /* ── view: flows ─────────────────────────────────────────────────── */
  function vFlows(rest) {
    const d = D(), tab = rest[0] === 'causes' ? 'causes' : 'flows';
    const readOnly = !can('flows');
    const runs = (f) => {
      const a = d.alerts.filter((x) => x.flow === f.id).map((x) => x.name), s = d.schedules.filter((x) => x.flow === f.id).map((x) => x.name), w = d.conditionWork.filter((x) => x.flow === f.id).map((x) => x.name), c = d.causes.filter((x) => x.fix === f.id).map((x) => x.name);
      const n = a.length + s.length + w.length + c.length;
      return n ? `${n} — ${[...a, ...s, ...w].slice(0, 2).map(esc).join(', ')}${c.length ? (a.length + s.length + w.length ? ', ' : '') + 'fixes ' + c.slice(0, 2).map(esc).join(', ') : ''}${n > 2 ? '…' : ''}` : '<span style="color:#8a5000">nothing runs it yet</span>';
    };
    const tabs = `<div class="seg" style="margin-bottom:14px"><button aria-pressed="${tab === 'flows'}" onclick="location.hash='#/flows'">Flows</button><button aria-pressed="${tab === 'causes'}" onclick="location.hash='#/flows/causes'">Causes</button></div>`;
    if (tab === 'causes') {
      return `<div class="pagehead"><div class="grow"><h1>Flows</h1><p class="lede">A diagnostic flow ends at a cause. A cause names its fix. Causes are shared across every plant so "what goes wrong" can be counted with one word.</p></div>${readOnly ? '' : '<div class="actions"><button class="btn primary" id="addCause">New cause</button></div>'}</div>${tabs}
        <div class="card"><div class="bd tight"><table class="tbl"><thead><tr><th>Cause</th><th>Where it applies</th><th>Diagnosed by</th><th>Fixed by</th></tr></thead><tbody>
        ${d.causes.map((c) => { const dx = d.flows.filter((f) => f.kind === 'diagnostic' && f.steps.some((st) => Object.values(st.answers || {}).some((a) => a.t === 'cause' && a.id === c.id))); return `<tr class="click" data-cause="${c.id}"><td><b>${esc(c.name)}</b>${c.sensorFault ? ' <span class="chip">Sensor fault</span>' : ''}</td><td class="muted">${c.stage ? esc(stage(c.stage).name) : 'Any stage'}${c.type ? ' · ' + esc(c.type) : ''}</td><td class="muted">${dx.length ? dx.map((f) => esc(f.name)).join(', ') : 'no flow reaches it'}</td><td>${c.fix ? esc(flow(c.fix).name) : c.sensorFault ? '<span class="muted">closes as a sensor fault</span>' : '<span style="color:#8a5000">nothing yet</span>'}</td></tr>`; }).join('')}
        </tbody></table></div></div>`;
    }
    return `<div class="pagehead"><div class="grow"><h1>Flows</h1><p class="lede">A <b>diagnostic flow</b> asks questions until it reaches a cause. An <b>action flow</b> is the list of steps that does the work. Alerts open diagnostic flows; schedules and causes run action flows.</p></div>${readOnly ? '' : '<div class="actions"><button class="btn" id="newAction">New action flow</button><button class="btn primary" id="newDiag">New diagnostic flow</button></div>'}</div>${tabs}
      <div class="card"><div class="bd tight"><table class="tbl"><thead><tr><th>Flow</th><th>Kind</th><th>For</th><th>Steps</th><th>Runs when</th><th>Status</th></tr></thead><tbody>
      ${d.flows.map((f) => `<tr class="click" data-flow="${f.id}"><td><b>${esc(f.name)}</b> <span class="muted mono">v${f.version}</span></td><td><span class="chip ${f.kind === 'diagnostic' ? 'info' : ''}">${cap(f.kind)}</span></td><td class="muted">${esc(f.forType || 'Any')}</td><td class="mono">${f.steps.length}</td><td class="small">${runs(f)}</td><td><span class="chip ${f.status === 'published' ? 'ok' : 'draft'}">${cap(f.status)}</span></td></tr>`).join('')}
      </tbody></table></div></div>`;
  }

  /* ── view: people & alerts ───────────────────────────────────────── */
  function vPeople() {
    const d = D(), g = gaps(), edit = can('people'), site = can('site');
    const roster = d.people.map((p) => `<tr class="click" data-person="${p.id}"><td><b>${esc(p.name)}</b>${p.company ? ` <span class="muted small">· ${esc(p.company)}</span>` : ''}${p.plants ? ` <span class="muted small">· ${p.plants} plants</span>` : ''}</td><td><span class="chip ${p.role === 'l3' || p.role === 'l4' ? 'navy' : ''}">${ROLE_LABEL[p.role]}</span>${p.grant ? ` <span class="chip teal">${GRANT_LABEL[p.grant]}</span>` : ''}</td><td>${p.phone.verified ? `<span class="chip ok">Verified · ${p.phone.channel === 'wa' ? 'WhatsApp' : 'SMS'}</span>` : '<span class="chip warn">Not verified — in-app only</span>'}</td><td class="small muted">Major: ${p.major === 'now' ? 'Now' : p.major === 'email' ? 'Morning email' : 'Off'} · quiet ${esc(p.quiet)}</td></tr>`).join('');
    const rung = (sev) => issueLadder(sev).map(([w, p]) => `<div class="r"><div class="w">${esc(w)}</div><div class="p">${p}</div></div>`).join('');
    return `<div class="pagehead"><div class="grow"><h1>People &amp; alerts</h1><p class="lede">Who is told is fixed by role and resolved from this roster the moment something fires. The only levers here: who holds which role, the site's quiet hours, and the hooter.</p></div></div>
      <div class="health ${g.routingOk ? 'ok' : 'err'}"><div class="ic">${g.routingOk ? '✓' : '!'}</div><div><b>${g.routingOk ? 'Alerts will reach a human' : 'Alerts may reach nobody'}</b><p>${g.routingOk ? `${plural(g.reachOps.length, 'Operator')} and ${plural(g.reachLeads.length, 'Lead')} can be reached now. 0 people had messages fail this week.` : esc(g.routingWhy)}</p></div></div>
      <div class="card" style="margin-top:16px"><div class="hd"><h2>Roster</h2><span class="hint">One role per person. A role describes the person, not the plant.</span>${edit ? '<button class="btn sm" id="addPerson">Add person</button>' : ''}</div>
        <div class="bd tight"><table class="tbl"><thead><tr><th>Person</th><th>Role</th><th>Phone</th><th>Their own settings</th></tr></thead><tbody>${roster}</tbody></table></div></div>
      <div class="card"><div class="hd"><h2>Who is told, right now</h2><span class="hint">Resolved from the roster above. Read-only — nothing here is drawn by hand.</span></div>
        <div class="bd" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          ${['emergency', 'major', 'minor', 'caution'].map((s) => `<div><div style="margin-bottom:6px"><span class="sev ${s}">${SEV_LABEL[s]}</span> <span class="muted small">start within ${fmtH(SEV_CLOCK[s][0])} · fix within ${fmtH(SEV_CLOCK[s][1])}</span></div><div class="told">${rung(s)}</div></div>`).join('')}
        </div></div>
      <div class="card"><div class="hd"><h2>Site defaults</h2><span class="hint">${site ? 'People Admin' : 'Read-only for ' + esc(PERSONA[S.persona].label)}</span></div>
        <div class="bd" style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
          <div class="f"><span class="l">Default quiet hours for new people</span><div class="inl"><input type="time" value="${d.plant.quietHours.from}" id="qhFrom" ${site ? '' : 'disabled'}> to <input type="time" value="${d.plant.quietHours.to}" id="qhTo" ${site ? '' : 'disabled'}></div><div class="h">Holds Minor and Caution until the morning email. Major and Emergency always come. Each person can change their own.</div></div>
          <div class="f"><span class="l">Hooter</span><div class="inl"><label class="toggle"><input type="checkbox" id="hooterOn" ${d.plant.hooter.on ? 'checked' : ''} ${site ? '' : 'disabled'}> <span>On at this plant</span></label> <select id="hooterSec" ${site ? '' : 'disabled'}>${[30, 60, 90, 120].map((s) => `<option ${d.plant.hooter.seconds === s ? 'selected' : ''} value="${s}">${s} s</option>`).join('')}</select></div><div class="h">Emergency only, and only ever Emergency. The platform confirms the command left, never that the siren sounded — the quarterly function test on the plant page is the confirmation.</div></div>
        </div>${site ? '<div class="bd" style="padding-top:0"><button class="btn primary" id="saveSite">Save site defaults</button></div>' : ''}</div>`;
  }

  /* ── view: activity ──────────────────────────────────────────────── */
  function vActivity() {
    return `<div class="pagehead"><div class="grow"><h1>Activity</h1><p class="lede">Anything that changes who gets woken up: limits, alerts, schedules, flows, the roster, site defaults. Kept 24 months.</p></div></div>
      <div class="card"><div class="bd tight audit">${D().audit.map((a) => `<div class="r"><div class="w">${esc(a.ts)}</div><div><div>${esc(a.what)} <span class="muted">— ${esc(a.who)}</span></div><div class="b">${esc(a.detail)}</div></div></div>`).join('')}</div></div>`;
  }

  /* ── view: standard sets (global) ────────────────────────────────── */
  function vStandards() {
    const d = D();
    return `<div class="pagehead"><div class="grow"><h1>Standard sets</h1><p class="lede">One set per equipment type: the alerts and schedules every plant with that machine should have. A set names sensor kinds and default limits; a plant binds it to a real machine and its tags, then checks the numbers.</p></div><div class="actions"><button class="btn primary" id="newSet">New standard set</button></div></div>
      <div class="note teal" style="margin-bottom:14px"><span><b>Global.</b> You are editing shapes. A change here reaches every plant following the set; plants that pinned a version keep it until they choose to update.</span></div>
      ${d.standardSets.map((t) => `<div class="card"><div class="hd"><h2>${esc(t.type)}</h2><span class="hint">used at ${t.usedAt} plants</span><button class="btn sm" data-rollout="${t.id}">Roll out to plants</button></div><div class="bd" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div><div class="small muted" style="margin-bottom:6px">ALERTS</div>${t.alerts.length ? t.alerts.map((a) => `<div style="margin-bottom:6px"><b>${esc(a.name)}</b><div class="small muted">${esc(a.sensorKind)} ${a.direction === 'below' ? 'falls below' : 'rises above'} ${fmtLimits(a.limits, a.direction, '')}${a.flow ? ' · opens ' + esc(flow(a.flow).name) : ''}</div></div>`).join('') : '<span class="muted small">none</span>'}</div>
        <div><div class="small muted" style="margin-bottom:6px">SCHEDULES</div>${t.schedules.map((s) => `<div style="margin-bottom:6px"><b>${esc(s.name)}</b> <span class="chip">${WT_LABEL[s.workType]}</span><div class="small muted">${s.workType === 'condition' ? `when ${esc(s.sensorKind)} > ${s.doWhen}, done < ${s.doneWhen}` : cap(every(s))}${s.flow ? ' · runs ' + esc(flow(s.flow).name) : ''}</div></div>`).join('')}</div>
      </div></div>`).join('')}`;
  }

  /* ── wiring per view ─────────────────────────────────────────────── */
  function wire(view) {
    if (view === 'equipment') {
      $('#treeq')?.addEventListener('input', (e) => { S.treeFilter = e.target.value; const t = $('.tree'); t.outerHTML = vTree(); wire('equipment'); $('#treeq').focus(); $('#treeq').setSelectionRange(99, 99); });
      $$('.tree .node').forEach((n) => n.onclick = () => { location.hash = '#/equipment/' + n.dataset.node; });
      $$('tr[data-sensor]').forEach((r) => r.onclick = () => openSheet({ kind: 'sensor', id: r.dataset.sensor }));
      $$('[data-alert]').forEach((r) => r.onclick = () => openSheet({ kind: 'alert', id: r.dataset.alert }));
      $$('[data-sched]').forEach((r) => r.onclick = () => openSheet({ kind: 'schedule', id: r.dataset.sched }));
      $$('[data-work]').forEach((r) => r.onclick = () => openSheet({ kind: 'work', id: r.dataset.work }));
      $('#addAlert')?.addEventListener('click', () => openSheet({ kind: 'alert', id: null }));
      $('#addSched')?.addEventListener('click', () => openSheet({ kind: 'schedule', id: null }));
      $('#addWork')?.addEventListener('click', () => openSheet({ kind: 'work', id: null }));
      $('#reviewSet')?.addEventListener('click', (e) => openSheet({ kind: 'standard', t: e.currentTarget.dataset.t }));
      $('#addMenu')?.addEventListener('click', () => modal('Add to ' + subjectName(parseNode(S.node)), `<div class="pick">
          <label><input type="radio" name="k" value="alert" checked><div><b>Alert</b><span>Something is wrong when a reading crosses a limit. Creates an issue with a severity; someone must fix it.</span></div></label>
          <label><input type="radio" name="k" value="schedule"><div><b>Schedule</b><span>Planned work on a calendar or a meter — a routine check, preventive maintenance, a calibration.</span></div></label>
          <label><input type="radio" name="k" value="work"><div><b>Condition-based work</b><span>A job the plant asks for when a reading crosses a line — a backwash, a filter clean. The process working, not failing.</span></div></label>
        </div>`, [{ label: 'Cancel' }, { label: 'Continue', primary: true, fn: (m) => openSheet({ kind: $('input[name=k]:checked', m).value, id: null }) }]));
      $('#addMilestone')?.addEventListener('click', () => toast('Milestones are a small list, not a form mode — this prototype does not add new ones.'));
      $('[data-override]')?.addEventListener('click', (e) => { e.preventDefault(); const ev = eq(parseNode(S.node).id); modal('Override criticality on ' + ev.name, `<div class="f"><span class="l">Tier</span><div class="seg" id="ovTier">${['A', 'B', 'C'].map((t) => `<button aria-pressed="${ev.tier === t}" data-v="${t}">${t} · ${TIER_LABEL[t]}</button>`).join('')}</div><div class="h">Task clocks and escalation read this tier. The override is audited and shown on the equipment card.</div></div><div class="f"><label class="l">Reason (required)</label><textarea id="ovWhy" placeholder="e.g. the only blower on the basin since BL-2 was retired"></textarea></div>`, [{ label: 'Cancel' }, { label: 'Override', primary: true, fn: (m) => { const why = $('#ovWhy', m).value.trim(); if (!why) { $('#ovWhy', m).focus(); return true; } const t = $('#ovTier button[aria-pressed=true]', m).dataset.v; audit(`Overrode criticality on ${ev.name}`, `${ev.tier} → ${t}: ${why}`); ev.tier = t; ev.tierReason = why; render(); toast('Criticality overridden and audited'); } }]); $$('#ovTier button').forEach((b) => b.onclick = () => { $$('#ovTier button').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); }); });
    }
    if (view === 'flows') {
      $$('tr[data-flow]').forEach((r) => r.onclick = () => openSheet({ kind: 'flow', id: r.dataset.flow }));
      $$('tr[data-cause]').forEach((r) => r.onclick = () => openSheet({ kind: 'cause', id: r.dataset.cause }));
      $('#newAction')?.addEventListener('click', () => openSheet({ kind: 'flow', id: null, newKind: 'action' }));
      $('#newDiag')?.addEventListener('click', () => openSheet({ kind: 'flow', id: null, newKind: 'diagnostic' }));
      $('#addCause')?.addEventListener('click', () => openSheet({ kind: 'cause', id: null }));
    }
    if (view === 'people') {
      $$('tr[data-person]').forEach((r) => r.onclick = () => openSheet({ kind: 'person', id: r.dataset.person }));
      $('#addPerson')?.addEventListener('click', () => openSheet({ kind: 'person', id: null }));
      $('#saveSite')?.addEventListener('click', () => { const p = D().plant; p.quietHours.from = $('#qhFrom').value; p.quietHours.to = $('#qhTo').value; p.hooter.on = $('#hooterOn').checked; p.hooter.seconds = +$('#hooterSec').value; audit('Changed site defaults', `Quiet hours ${p.quietHours.from}–${p.quietHours.to} · hooter ${p.hooter.on ? 'on, ' + p.hooter.seconds + ' s' : 'off'}`); toast('Site defaults saved. Applies to people who never set their own.'); });
    }
    if (view === 'standards') {
      $$('[data-rollout]').forEach((b) => b.onclick = () => modal('Roll out to plants', `<p class="small muted" style="margin-bottom:10px">Creates drafts at each plant that has this machine type and the sensor kinds the alerts read. Plants that cannot take it are listed with the reason.</p><div class="pick">${[['Manesar STP', true, 'ready · Air Blower 1, Air Blower 2'], ['Bawal WTP', true, 'ready · 1 machine'], ['Vedanta 200 KLD', false, 'no line-pressure sensor on its blower — add the tag first'], ['Amazon DEL-4', true, 'ready · 3 machines']].map(([n, ok, s]) => `<label style="${ok ? '' : 'opacity:.6'}"><input type="checkbox" ${ok ? 'checked' : 'disabled'}><div><b>${n}</b><span>${s}</span></div></label>`).join('')}</div>`, [{ label: 'Cancel' }, { label: 'Create drafts at 3 plants', primary: true, fn: () => toast('Drafts created at 3 plants. Someone at each plant checks the numbers before activating.') }]));
      $('#newSet')?.addEventListener('click', () => toast('A standard set is authored like an alert or schedule, with sensor kinds instead of tags. Not built in this prototype.'));
    }
  }

  /* ── sheets ──────────────────────────────────────────────────────── */
  function renderSheet() {
    $('#sheet')?.remove(); $('#scrim')?.remove();
    if (!S.sheet) return;
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim'; scrim.onclick = closeSheet;
    const el = document.createElement('div'); el.className = 'sheet'; el.id = 'sheet';
    const fn = { alert: shAlert, schedule: shSchedule, work: shWork, sensor: shSensor, standard: shStandard, flow: shFlow, cause: shCause, person: shPerson }[S.sheet.kind];
    document.body.appendChild(scrim); document.body.appendChild(el);
    fn(el);
    $('.x', el)?.addEventListener('click', closeSheet);
    document.onkeydown = (e) => { if (e.key === 'Escape') closeSheet(); };
  }
  const sheetFrame = (el, title, sub, body, foot, wide) => { if (wide) el.classList.add('wide'); el.innerHTML = `<div class="sh"><div style="flex:1"><h2>${title}</h2><div class="sub">${sub}</div></div><button class="x" aria-label="Close">×</button></div><div class="sb">${body}</div><div class="sf">${foot}</div>`; };
  const segWire = (el, id, cb) => $$(`#${id} button`, el).forEach((b) => b.onclick = () => { $$(`#${id} button`, el).forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); cb && cb(b.dataset.v); });
  const segVal = (el, id) => $(`#${id} button[aria-pressed=true]`, el)?.dataset.v;

  /* alert editor */
  function shAlert(el) {
    const d = D(), sub = parseNode(S.node);
    const isNew = !S.sheet.id;
    const a = isNew ? { id: uid('a'), name: '', subject: sub, sensor: null, limits: 'sensor', custom: { caution: null, minor: null, major: null, emergency: null }, direction: 'below', holdMin: 0, closes: { mode: 'sensor', back: null, holdMin: 15 }, flow: null, cause: null, verify: false, status: 'draft', open: 0 } : clone(alertById(S.sheet.id));
    const readOnly = !can('equipment');
    const frozen = a.open > 0;
    const candidates = sensorsOf(a.subject).filter((s) => s.kind !== 'meter');
    if (!a.sensor && candidates.length) a.sensor = candidates[0].id;
    const draw = () => {
      const s = sensor(a.sensor);
      const dir = a.limits === 'custom' ? a.direction : (s.direction || 'below');
      const lim = a.limits === 'custom' ? a.custom : (s.limits || {});
      const entry = entrySeverity(lim), deep = deepestSeverity(lim);
      if (isNew && !a.name && s) a.name = `${s.name} ${dir === 'below' ? 'low' : 'high'} — ${a.subject.kind === 'eq' ? eq(a.subject.id).tag : subjectName(a.subject)}`;
      if (a.closes.back == null && entry) a.closes.back = lim[entry];
      const diagFlows = d.flows.filter((f) => f.status === 'published' && f.kind === 'diagnostic');
      const clocks = a.clocks ? [a.clocks.response, a.clocks.deadline] : null;
      const ladder = entry ? issueLadder(entry, clocks) : null;
      const checks = validateAlert(a);
      const errs = checks.filter((c) => c.level === 'err').length;
      const opCard = `<div class="preview dark"><div class="ph">What the operator sees</div><div class="ti">${esc(a.name || 'Untitled alert')}</div><div class="rd">${s.kind === 'status' ? (s.reading ? 'ON' : 'OFF') : s.reading} <span class="u">${esc(s.unit)}</span></div><div class="mt">${esc(subjectName(a.subject))}${a.subject.kind !== 'eq' ? ' · read on ' + esc(sensorHome(s).tag) : ''} · ${entry ? `<span class="sev ${entry}">${SEV_LABEL[entry]}</span>` : 'no severity yet'}</div><div class="mt" style="margin-top:6px">${a.flow ? 'Step 1 of ' + flow(a.flow).steps.length + ': ' + esc(flow(a.flow).steps[0].text) : a.cause ? 'Cause: ' + esc(cause(a.cause).name) + ' → fix' : 'Close with a photo or note'}</div><div class="cta">Start working →</div></div>`;
      const body = `
        ${frozen ? `<div class="note warn" style="margin-bottom:14px"><span><b>${plural(a.open, 'open record')} — the terms are frozen.</b> Name and status can change; limits, closing rule and flow cannot until it closes. To change them urgently: switch off, duplicate, fix the copy.</span></div>` : ''}
        <div class="two"><div>
        <div class="fs"><div class="t"><span class="n">1</span>What to watch</div>
          <div class="f"><label class="l">Name</label><input type="text" id="aName" value="${esc(a.name)}" ${readOnly ? 'disabled' : ''}></div>
          <div class="f inline"><div><label class="l">Sensor</label><select id="aSensor" ${readOnly || frozen ? 'disabled' : ''}>${candidates.map((c) => `<option value="${c.id}" ${c.id === a.sensor ? 'selected' : ''}>${esc(c.name)}${a.subject.kind !== 'eq' ? ' — ' + esc(sensorHome(c).tag) : ''} (${esc(c.unit) || 'on/off'})</option>`).join('')}</select></div>
            <div><span class="l">Worse when the reading</span><div class="seg" id="aDir">${['below', 'above'].map((v) => `<button data-v="${v}" aria-pressed="${dir === v}" ${readOnly || frozen || a.limits === 'sensor' ? 'disabled' : ''}>${v === 'below' ? 'Falls' : 'Rises'}</button>`).join('')}</div>${a.limits === 'sensor' ? '<div class="h">Follows the sensor\'s limits</div>' : ''}</div></div>
          ${s.setpoint ? `<div class="note" style="margin-bottom:10px"><span>PLC set point on this sensor is <b>${s.setpoint.value} ${esc(s.unit)}</b> (${esc(s.setpoint.tag)}). Alert limits should sit past the control band, or the alert fires while the PLC is still doing its job.</span></div>` : ''}
        </div>
        <div class="fs"><div class="t"><span class="n">2</span>Limits <span class="hint">${a.limits === 'sensor' ? 'from the sensor — shared by every alert on it' : 'custom to this alert'}</span></div>
          <div class="seg sm" id="aLimMode" style="margin-bottom:10px"><button data-v="sensor" aria-pressed="${a.limits === 'sensor'}" ${readOnly || frozen ? 'disabled' : ''}>Use the sensor's limits</button><button data-v="custom" aria-pressed="${a.limits === 'custom'}" ${readOnly || frozen ? 'disabled' : ''}>Custom for this alert</button></div>
          <div class="limitgrid">${SEVS.slice().reverse().map((k) => `<div class="lab"><span class="sev ${k}">${SEV_LABEL[k]}</span></div><div><input type="number" step="any" data-lim="${k}" value="${lim[k] ?? ''}" placeholder="—" ${readOnly || frozen || a.limits === 'sensor' ? 'disabled' : ''}></div><div class="sk">${k === 'emergency' ? 'phone call + hooter · fires on the first reading' : k === 'caution' ? 'in-app only, never reminds' : k === 'major' ? 'full-screen alarm · Lead told' : 'WhatsApp to operators'}</div>`).join('')}</div>
          <div class="h">${a.limits === 'sensor' ? `Edit them on the sensor to change every alert that follows it. ` : ''}Blank tiers are skipped. ${s.kind !== 'status' ? `${esc(s.name)} reads ${s.valid[0]}–${s.valid[1]} ${esc(s.unit)}; anything outside is a sensor fault, never an alert.` : ''}</div>
          <details class="adv"><summary>Hold time and gating</summary><div><div class="f inline"><div><label class="l">Hold for</label><div class="inl"><input type="number" id="aHold" min="0" value="${a.holdMin}" ${readOnly || frozen || entry === 'emergency' ? 'disabled' : ''}> min</div><div class="h">${entry === 'emergency' ? 'Pinned at 0: an Emergency fires on the first reading that crosses.' : 'Reading must stay past the limit this long. 0 = the first reading.'}</div></div><div><label class="l">Only when</label><select disabled><option>Always</option><option>Blower running (PRESS-BL1 &gt; 0.2)</option></select><div class="h">Gate on another sensor so a planned shutdown does not raise it. (Compound condition, kept from the formula builder.)</div></div></div>
          ${eq(sensorHome(s).id).cycles ? `<div class="f"><label class="l">During a cycle phase</label><select id="aCycle" ${readOnly ? 'disabled' : ''}><option value="">Any time</option>${d.cycles.filter((c) => c.eq === sensorHome(s).id).flatMap((c) => c.phases.map((p) => `<option value="${p.name}" ${a.cycle && a.cycle.only === p.name ? 'selected' : ''}>Only during ${esc(p.name)} (${esc(c.name)})</option>`)).join('')}</select><div class="h">A limit that is a fault in one phase is expected in another. The issue closes at the cycle boundary if the phase ends before anyone acts.</div></div>` : ''}</div></details>
        </div>
        <div class="fs"><div class="t"><span class="n">3</span>When it closes</div>
          <div class="seg" id="aClose" style="margin-bottom:10px"><button data-v="sensor" aria-pressed="${a.closes.mode === 'sensor'}" ${readOnly || frozen || s.kind === 'status' ? 'disabled' : ''}>The sensor says so</button><button data-v="operator" aria-pressed="${a.closes.mode === 'operator'}" ${readOnly || frozen ? 'disabled' : ''}>The operator declares it fixed</button></div>
          ${a.closes.mode === 'sensor' ? `<div class="inl">Back ${dir === 'below' ? 'above' : 'below'} <input type="number" step="any" id="aBack" value="${a.closes.back ?? ''}" ${readOnly || frozen ? 'disabled' : ''}> ${esc(s.unit)} for <input type="number" id="aBackHold" value="${a.closes.holdMin}" ${readOnly || frozen ? 'disabled' : ''}> min</div><div class="h">A little past the entry limit so a reading resting on it does not flap. Nothing closes on elapsed time — a clock cannot see a fix.</div>` : `<div class="h">The operator closes it with a photo or a note. Use this where no sensor can witness the fix — a cleared screen, a replaced fuse, a lab result. If they think the reading is wrong they report a sensor fault instead, which pauses the sensor and goes to the Technical Admin.</div>`}
        </div>
        <div class="fs"><div class="t"><span class="n">4</span>What the operator does</div>
          <div class="f inline"><div><label class="l">Diagnostic flow</label><select id="aFlow" ${readOnly || frozen ? 'disabled' : ''}><option value="">None — close with proof</option>${diagFlows.map((f) => `<option value="${f.id}" ${a.flow === f.id ? 'selected' : ''}>${esc(f.name)}${f.forType ? ' · ' + esc(f.forType) : ''}</option>`).join('')}</select><div class="h">Asks questions until it reaches a cause, then opens the fix. <a href="#/flows">Flows →</a></div></div>
          <div><label class="l">Or the cause is already known</label><select id="aCause" ${readOnly || frozen || a.flow ? 'disabled' : ''}><option value="">—</option>${d.causes.filter((c) => !c.sensorFault).map((c) => `<option value="${c.id}" ${a.cause === c.id ? 'selected' : ''}>${esc(c.name)}${c.fix ? ' → ' + esc(flow(c.fix).name) : ' (no fix yet)'}</option>`).join('')}</select><div class="h">Opens straight at the fix. The operator can still say "that's not it".</div></div></div>
          <label class="toggle"><input type="checkbox" id="aVerify" ${a.verify ? 'checked' : ''} ${readOnly || frozen ? 'disabled' : ''}> <span>A Lead must verify before it closes</span></label>
        </div>
        <div class="fs"><div class="t"><span class="n">5</span>Who is told <span class="hint">from the roster, by role — nothing to draw</span></div>
          ${ladder ? toldBlock(ladder) : '<div class="h">Set a limit first.</div>'}
          ${entry && entry !== deep ? `<div class="h">Starts at ${SEV_LABEL[entry]}; gets louder and reaches further as deeper limits are crossed, up to ${SEV_LABEL[deep]}. Going back down is silent.</div>` : ''}
          ${entry && entry !== 'caution' ? `<details class="adv"><summary>Change the response time and deadline for this alert</summary><div><div class="f inline"><div><label class="l">Must start within</label><div class="inl"><input type="number" id="aResp" value="${a.clocks ? a.clocks.response : SEV_CLOCK[entry][0]}" ${readOnly || frozen ? 'disabled' : ''}> h</div></div><div><label class="l">Must be fixed within</label><div class="inl"><input type="number" id="aDead" value="${a.clocks ? a.clocks.deadline : SEV_CLOCK[entry][1]}" ${readOnly || frozen ? 'disabled' : ''}> h</div></div></div><div class="h">Defaults come from severity (${SEV_LABEL[entry]}: ${SEV_CLOCK[entry][0]} h / ${SEV_CLOCK[entry][1]} h). These two numbers are the only part of the ladder a Technical Admin may change, per alert. The list marks it as an exception.</div></div></details>` : ''}
        </div>
        <div class="fs"><div class="t"><span class="n">✓</span>Ready to activate?</div><div class="checks">${checks.map((c) => `<div class="c ${c.level}">${c.level === 'ok' ? '✓' : c.level === 'err' ? '✕' : '!'} <span>${c.text}</span></div>`).join('')}</div></div>
        </div>
        <div><div class="side">${opCard}
          <div class="fs" style="margin-top:12px"><div class="t">Try it</div><div class="inl">If ${esc(s.name)} reads <input type="number" step="any" id="tryVal" value="${s.reading}"> ${esc(s.unit)}</div><div id="tryOut" class="h" style="margin-top:8px"></div></div>
          <div class="model" style="margin-top:12px"><div class="fs" style="font-family:var(--mono);font-size:11px"><b>Under the hood</b><br>Trigger { outcome:'issue', triggerType:'alert', subject:${subjectKey(a.subject)}, severityBands:[${SEVS.filter((k) => lim[k] != null).map((k) => `{${k}: ${lim[k]}}`).join(', ')}], inheritsSensorZones:${a.limits === 'sensor'}, observationPolls:${a.holdMin ? 'from hold' : 1}, resolutionType:'${a.closes.mode === 'sensor' ? 'condition' : 'manual'}'${a.flow ? `, procedureTreeId:'${a.flow}'` : ''}${a.verify ? ', requiresSupervisorVerification:true' : ''}${a.clocks ? ', clocks override (brief §4.1)' : ''} }<br>SignalCondition minted per band on ${esc(s.tag)}; ruleSnapshot kept per record.</div></div>
        </div></div></div>`;
      const foot = readOnly ? `<span class="grow">Read-only for ${esc(PERSONA[S.persona].label)}.</span><button class="btn" id="aCancel">Close</button>`
        : `<span class="grow">${frozen ? 'Only name and status can be saved while records are open.' : errs ? `${plural(errs, 'thing')} to fix before it can run. A draft never fires.` : 'A draft never fires; Activate runs every check.'}</span>
           ${!isNew ? `<button class="btn ghost danger" id="aDelete">Delete</button>` : ''}${!isNew && a.status === 'active' ? `<button class="btn" id="aOff">Switch off</button>` : ''}<button class="btn" id="aDraft">Save draft</button><button class="btn primary" id="aActivate" ${errs ? 'disabled' : ''}>${a.status === 'active' ? 'Save' : 'Activate'}</button>`;
      sheetFrame(el, isNew ? `New alert on ${esc(subjectName(a.subject))}` : esc(a.name), `${a.subject.kind === 'eq' ? 'Machine' : cap(a.subject.kind)} · ${esc(subjectName(a.subject))}${!isNew ? ` · <span class="chip ${a.status === 'active' ? 'ok' : 'draft'}">${cap(a.status)}</span>` : ''}`, body, foot, true);
      /* wire */
      const rerender = () => draw();
      $('#aName', el).oninput = (e) => { a.name = e.target.value; };
      $('#aSensor', el).onchange = (e) => { a.sensor = e.target.value; a.name = ''; a.closes.back = null; rerender(); };
      segWire(el, 'aDir', (v) => { a.direction = v; rerender(); });
      segWire(el, 'aLimMode', (v) => { a.limits = v; if (v === 'custom') { a.custom = { ...(sensor(a.sensor).limits || { caution: null, minor: null, major: null, emergency: null }) }; a.direction = sensor(a.sensor).direction || 'below'; } rerender(); });
      $$('[data-lim]', el).forEach((i) => i.onchange = () => { a.custom[i.dataset.lim] = i.value === '' ? null : +i.value; rerender(); });
      $('#aHold', el) && ($('#aHold', el).onchange = (e) => { a.holdMin = +e.target.value; rerender(); });
      $('#aCycle', el) && ($('#aCycle', el).onchange = (e) => { a.cycle = e.target.value ? { id: d.cycles.find((c) => c.eq === sensorHome(sensor(a.sensor)).id).id, only: e.target.value } : null; rerender(); });
      segWire(el, 'aClose', (v) => { a.closes.mode = v; rerender(); });
      $('#aBack', el) && ($('#aBack', el).onchange = (e) => { a.closes.back = +e.target.value; rerender(); });
      $('#aBackHold', el) && ($('#aBackHold', el).onchange = (e) => { a.closes.holdMin = +e.target.value; });
      $('#aFlow', el).onchange = (e) => { a.flow = e.target.value || null; if (a.flow) a.cause = null; rerender(); };
      $('#aCause', el).onchange = (e) => { a.cause = e.target.value || null; rerender(); };
      $('#aVerify', el).onchange = (e) => { a.verify = e.target.checked; rerender(); };
      $('#aResp', el) && ($('#aResp', el).onchange = () => { a.clocks = { response: +$('#aResp', el).value, deadline: +$('#aDead', el).value }; rerender(); });
      $('#aDead', el) && ($('#aDead', el).onchange = () => { a.clocks = { response: +$('#aResp', el).value, deadline: +$('#aDead', el).value }; rerender(); });
      const tryIt = () => {
        const v = +$('#tryVal', el).value, out = $('#tryOut', el);
        const crossed = SEVS.slice().reverse().find((k) => lim[k] != null && (dir === 'below' ? v < lim[k] : v > lim[k]));
        if (s.kind !== 'status' && (v < s.valid[0] || v > s.valid[1])) { out.innerHTML = `<b>Refused as a sensor fault.</b> ${esc(s.name)} cannot read ${v} ${esc(s.unit)}. No alert; the Technical Admin and the Lead are told about the sensor.`; return; }
        if (!crossed) { out.innerHTML = `Nothing happens. ${v} ${esc(s.unit)} is inside every limit.`; return; }
        const lad = issueLadder(crossed, clocks);
        out.innerHTML = `<b>Opens a <span class="sev ${crossed}">${SEV_LABEL[crossed]}</span> issue</b>${a.holdMin ? ` after ${a.holdMin} min past the limit` : ' on the first reading'}. ${lad[0][1]}. Then: ${lad[1][0].toLowerCase()} → ${lad[1][1]}.`;
      };
      $('#tryVal', el).oninput = tryIt; tryIt();
      $('#aCancel', el) && ($('#aCancel', el).onclick = closeSheet);
      const save = (status) => {
        a.status = status;
        if (isNew) d.alerts.push(a); else Object.assign(alertById(a.id), a);
        audit(`${isNew ? 'Added' : 'Saved'} alert ${a.name}`, `${status === 'active' ? 'Active' : 'Draft'} · ${SEVS.filter((k) => lim[k] != null).map((k) => SEV_LABEL[k] + ' ' + lim[k]).join(' · ')} · closes ${a.closes.mode === 'sensor' ? 'by sensor' : 'by operator'}`);
        closeSheet(); render(); toast(status === 'active' ? `${esc(a.name)} is active. Told now: ${ladder ? ladder[0][1].replace(/<[^>]+>/g, '') : ''}` : `${esc(a.name)} saved as a draft — it will not fire.`);
      };
      $('#aDraft', el) && ($('#aDraft', el).onclick = () => save('draft'));
      $('#aActivate', el) && ($('#aActivate', el).onclick = () => save('active'));
      $('#aOff', el) && ($('#aOff', el).onclick = () => { alertById(a.id).status = 'off'; audit(`Switched off alert ${a.name}`, 'Open records stay open and must still be worked to a close'); closeSheet(); render(); toast(`${esc(a.name)} switched off. Open records stay open.`); });
      $('#aDelete', el) && ($('#aDelete', el).onclick = () => { if (frozen) { toast('Cannot delete while records are open. Switch it off instead.'); return; } const idx = d.alerts.findIndex((x) => x.id === a.id); const removed = d.alerts.splice(idx, 1)[0]; audit(`Deleted alert ${a.name}`, ''); closeSheet(); render(); toast(`Deleted ${esc(a.name)}.`, () => d.alerts.splice(idx, 0, removed)); });
    };
    draw();
  }
  function validateAlert(a) {
    const s = sensor(a.sensor); const out = [];
    if (!s) return [{ level: 'err', text: 'Pick a sensor.' }];
    const dir = a.limits === 'custom' ? a.direction : s.direction;
    const lim = a.limits === 'custom' ? a.custom : (s.limits || {});
    const set = SEVS.filter((k) => lim[k] != null);
    if (!set.length) out.push({ level: 'err', text: 'At least one limit is needed. Blank tiers are fine.' }); else out.push({ level: 'ok', text: `${plural(set.length, 'limit')}: ${set.map((k) => SEV_LABEL[k] + ' ' + lim[k]).join(' · ')}` });
    for (let i = 1; i < set.length; i++) { const a1 = lim[set[i - 1]], a2 = lim[set[i]]; if (dir === 'below' ? a2 >= a1 : a2 <= a1) { out.push({ level: 'err', text: `${SEV_LABEL[set[i]]} (${a2}) must be ${dir === 'below' ? 'lower' : 'higher'} than ${SEV_LABEL[set[i - 1]]} (${a1}) — deeper must mean worse.` }); break; } }
    if (s.kind !== 'status') { const bad = set.find((k) => lim[k] < s.valid[0] || lim[k] > s.valid[1]); if (bad) out.push({ level: 'err', text: `${SEV_LABEL[bad]} limit ${lim[bad]} is outside what ${s.name} can read (${s.valid[0]}–${s.valid[1]} ${s.unit}); it could never fire.` }); }
    if (set.includes('emergency') && a.holdMin > 0) out.push({ level: 'err', text: 'An Emergency must fire on the first reading — hold time must be 0.' });
    if (a.closes.mode === 'sensor' && set.length) { const entry = lim[set[0]]; if (a.closes.back == null) out.push({ level: 'err', text: 'Say what reading closes it.' }); else if (dir === 'below' ? a.closes.back < entry : a.closes.back > entry) out.push({ level: 'err', text: `Closing at ${a.closes.back} is past the entry limit ${entry}; it could close while still out of spec.` }); else if (a.closes.back === entry) out.push({ level: 'warn', text: 'Closing exactly at the entry limit lets a reading resting on it open and close repeatedly.' }); else out.push({ level: 'ok', text: `Closes when back ${dir === 'below' ? 'above' : 'below'} ${a.closes.back} ${s.unit}.` }); }
    if (a.closes.mode === 'operator') out.push({ level: 'ok', text: 'Closes on the operator\'s word with proof.' });
    if (set.includes('emergency') && !leads().some((p) => p.phone.verified)) out.push({ level: 'err', text: 'An Emergency must reach a Lead, and no Lead has a verified phone.' });
    if (a.verify && !leads().length) out.push({ level: 'err', text: 'Verification needs a Lead on the roster.' });
    if (!a.flow && !a.cause) out.push({ level: 'warn', text: 'No flow — the operator will see a simple open → done issue.' }); else if (a.cause && !cause(a.cause).fix) out.push({ level: 'warn', text: `${cause(a.cause).name} has no action flow: the operator is told the cause and nothing about what to do.` }); else out.push({ level: 'ok', text: a.flow ? `Opens ${flow(a.flow).name}.` : `Opens at the fix for ${cause(a.cause).name}.` });
    const dup = D().alerts.find((x) => x.id !== a.id && x.sensor === a.sensor && x.status !== 'off');
    if (dup) out.push({ level: 'warn', text: `${dup.name} already watches this sensor. Two alerts on one reading are usually one alert with more limits.` });
    if (s.state === 'stale') out.push({ level: 'warn', text: `${s.name} is stale right now — this alert cannot fire until it reports.` });
    return out;
  }

  /* schedule editor */
  function shSchedule(el) {
    const d = D(), sub = parseNode(S.node), isNew = !S.sheet.id;
    const sc = isNew ? { id: uid('s'), name: '', subject: sub, workType: 'routine', probe: null, flow: null, basis: 'calendar', every: { n: 1, unit: 'week' }, meter: null, anchor: 'fixed', nextDue: '2026-10-06', performedBy: 'in_house', statutory: false, verify: false, status: 'draft', open: 0 } : clone(schedById(S.sheet.id));
    const leadSheet = S.persona === 'lead';
    const leadOk = leadSheet && sc.workType === 'pm' && sc.performedBy !== 'vendor' && !isNew;
    const readOnly = !can('equipment') && !leadOk;
    const draw = () => {
      const tier = sc.statutory ? 'A' : subjectTier(sc.subject);
      const c = taskClocks(sc, tier);
      const actionFlows = d.flows.filter((f) => f.status === 'published' && f.kind === 'action');
      const probes = sensorsOf(sc.subject).filter((s) => s.kind === 'analytical');
      const meters = sensorsOf(sc.subject).filter((s) => s.kind === 'meter');
      const checks = validateSchedule(sc);
      const errs = checks.filter((x) => x.level === 'err').length;
      const stdChecklist = sc.subject.kind === 'eq' && !sc.flow ? `Standard checklist for ${esc(eq(sc.subject.id).type)}` : '';
      const lock = (field) => readOnly || (leadOk && !['every', 'nextDue', 'meter', 'tolerance', 'flow', 'pause'].includes(field));
      const body = `
        ${leadOk ? `<div class="note teal" style="margin-bottom:14px"><span><b>Lead edit from the equipment card.</b> Six fields: cadence, next due, meter interval, tolerance, flow, pause. ${sc.open ? `Today's occurrence is unchanged; this takes effect from the next one, ${esc(sc.nextDue)}.` : 'Applies from the next occurrence.'}</span></div>` : ''}
        ${leadSheet && !leadOk && !isNew ? `<div class="note" style="margin-bottom:14px"><span>${sc.workType === 'calibration' ? 'Calibration cadence is set by the Technical Admin only.' : sc.performedBy === 'vendor' ? 'This schedule comes from a vendor contract — Technical Admin only.' : 'Read-only.'}</span></div>` : ''}
        <div class="two"><div>
        <div class="fs"><div class="t"><span class="n">1</span>What kind of work</div>
          <div class="f"><label class="l">Name</label><input type="text" id="sName" value="${esc(sc.name)}" ${lock('name') ? 'disabled' : ''}></div>
          <div class="f"><span class="l">Work type</span><div class="seg" id="sWT">${['routine', 'pm', 'calibration'].map((w) => `<button data-v="${w}" aria-pressed="${sc.workType === w}" ${lock('workType') ? 'disabled' : ''}>${WT_LABEL[w]}</button>`).join('')}</div>
            <div class="h">${sc.workType === 'pm' ? 'Shows as a PM on the equipment card and counts toward maintenance coverage.' : sc.workType === 'calibration' ? 'Names a probe; shows on the sensor sheet with a Calibration chip.' : 'A reading round, a refill, a sample — planned, not maintenance.'}</div></div>
          ${sc.workType === 'calibration' ? `<div class="f"><label class="l">Probe</label><select id="sProbe" ${lock('probe') ? 'disabled' : ''}><option value="">—</option>${probes.map((p) => `<option value="${p.id}" ${sc.probe === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.tag)}</option>`).join('')}</select></div>` : ''}
          <div class="f"><label class="l">What to do</label><select id="sFlow" ${lock('flow') ? 'disabled' : ''}><option value="">${stdChecklist || 'Simple: open → in progress → done'}</option>${actionFlows.map((f) => `<option value="${f.id}" ${sc.flow === f.id ? 'selected' : ''}>${esc(f.name)}${f.forType ? ' · ' + esc(f.forType) : ''}</option>`).join('')}</select><div class="h">An action flow — the numbered steps the operator follows, with readings and photos where you ask for them.</div></div>
        </div>
        <div class="fs"><div class="t"><span class="n">2</span>How often</div>
          <div class="seg" id="sBasis" style="margin-bottom:10px"><button data-v="calendar" aria-pressed="${sc.basis === 'calendar'}" ${lock('every') ? 'disabled' : ''}>Calendar</button><button data-v="meter" aria-pressed="${sc.basis === 'meter'}" ${lock('every') || !meters.length ? 'disabled' : ''}>Run-hours</button><button data-v="either" aria-pressed="${sc.basis === 'either'}" ${lock('every') || !meters.length ? 'disabled' : ''}>Whichever first</button></div>
          ${sc.basis !== 'meter' ? `<div class="inl" style="margin-bottom:8px">Every <input type="number" min="1" id="sN" value="${sc.every.n}" ${lock('every') ? 'disabled' : ''}> <select id="sUnit" ${lock('every') ? 'disabled' : ''}>${['day', 'week', 'month', 'year'].map((u) => `<option value="${u}" ${sc.every.unit === u ? 'selected' : ''}>${u}${sc.every.n > 1 ? 's' : ''}</option>`).join('')}</select> counted from <select id="sAnchor" ${lock('every') ? 'disabled' : ''}><option value="last" ${sc.anchor === 'last' ? 'selected' : ''}>the last completion</option><option value="fixed" ${sc.anchor === 'fixed' ? 'selected' : ''}>fixed dates</option></select></div><div class="h">${sc.anchor === 'last' ? 'A six-monthly service done at month four is next due at month ten. Right for wear-out work.' : 'Does not drift when someone completes early. Right for rounds, statutory dates, contract visits.'}</div>` : ''}
          ${sc.basis !== 'calendar' ? `<div class="inl" style="margin:8px 0">${sc.basis === 'either' ? 'or every' : 'Every'} <input type="number" id="sHours" value="${sc.meter ? sc.meter.hours : 500}" ${lock('meter') ? 'disabled' : ''}> run-hours on <select id="sMeter" ${lock('meter') ? 'disabled' : ''}>${meters.map((m) => `<option value="${m.id}" ${sc.meter && sc.meter.tag === m.id ? 'selected' : ''}>${esc(m.name)} · ${esc(m.tag)} (${m.reading} h)</option>`).join('')}</select></div><div class="h">Never more often than every 30 days. If the meter goes quiet the calendar leg takes over and the list says so.</div>` : ''}
          <div class="f inline" style="margin-top:10px"><div><label class="l">Next due</label><input type="date" id="sNext" value="${sc.nextDue}" ${lock('nextDue') ? 'disabled' : ''}></div><div><span class="l">Performed by</span><div class="seg sm" id="sBy"><button data-v="in_house" aria-pressed="${sc.performedBy === 'in_house'}" ${lock('performedBy') ? 'disabled' : ''}>In-house</button><button data-v="vendor" aria-pressed="${sc.performedBy === 'vendor'}" ${lock('performedBy') ? 'disabled' : ''}>Vendor</button></div>${sc.performedBy === 'vendor' ? `<input type="text" style="margin-top:6px" id="sVendor" placeholder="Vendor name" value="${esc(sc.vendor || '')}" ${lock('performedBy') ? 'disabled' : ''}>` : ''}</div></div>
        </div>
        <div class="fs"><div class="t"><span class="n">3</span>How urgent</div>
          <div class="ro" style="margin-bottom:10px"><b>${sc.statutory ? 'Statutory' : `Tier ${tier} · ${TIER_LABEL[tier]}`}</b> — from ${sc.statutory ? 'the statutory flag' : subjectName(sc.subject)}${sc.subject.kind !== 'eq' ? ' (stage and plant work is tier B)' : ''}. Must start within <b>${fmtH(c.start)}</b>, finish within <b>${fmtH(c.deadline)}</b>${sc.tolerance != null ? ' (tolerance set below)' : ''}.</div>
          <label class="toggle"><input type="checkbox" id="sStat" ${sc.statutory ? 'checked' : ''} ${lock('statutory') || sc.subject.kind === 'plant' && false ? 'disabled' : ''}> <span>Statutory — required by law or consent; overdue the moment it is due</span></label>
          <details class="adv"><summary>Tolerance and sign-off</summary><div><div class="f inline"><div><label class="l">Grace before it counts as missed</label><div class="inl"><input type="number" id="sTol" value="${sc.tolerance ?? ''}" placeholder="${Math.round(c.deadline / 24 * 10) / 10}" ${lock('tolerance') ? 'disabled' : ''}> days</div><div class="h">Blank = ${TIER_SHARE[tier] * 100}% of the interval for tier ${tier}. A maintenance judgement about this machine, not a response time.</div></div><div><span class="l">&nbsp;</span><label class="toggle"><input type="checkbox" id="sVerify" ${sc.verify ? 'checked' : ''} ${lock('verify') ? 'disabled' : ''}> <span>A Lead signs off before it closes</span></label></div></div></div></details>
        </div>
        <div class="fs"><div class="t"><span class="n">4</span>Who is told</div>${toldBlock(taskLadder(sc, tier))}<div class="h">Quiet by design: planned work starts in the app and the morning email. It gets louder only as it gets late${tier === 'A' || sc.statutory ? ', and sooner because this is tier A' : ''}.</div></div>
        <div class="fs"><div class="t"><span class="n">✓</span>Ready?</div><div class="checks">${checks.map((x) => `<div class="c ${x.level}">${x.level === 'ok' ? '✓' : x.level === 'err' ? '✕' : '!'} <span>${x.text}</span></div>`).join('')}</div></div>
        </div>
        <div><div class="side"><div class="preview dark"><div class="ph">What the operator sees</div><div class="ti">${esc(sc.name || 'Untitled schedule')}</div><div class="mt" style="margin-top:4px">${sc.workType === 'pm' ? '<span class="chip teal">Preventive</span> ' : sc.workType === 'calibration' ? '<span class="chip info">Calibration</span> ' : ''}${tier === 'A' && !sc.statutory ? '<b>■ CRITICAL</b> ' : sc.statutory ? '<b>§ STATUTORY</b> ' : ''}${esc(subjectName(sc.subject))}</div><div class="mt">${cap(every(sc))} · due ${esc(sc.nextDue)}</div><div class="mt" style="margin-top:6px">${sc.flow ? `${flow(sc.flow).steps.length} steps · step 1: ${esc(flow(sc.flow).steps[0].text)}` : 'Open → done'}</div><div class="cta">Start task →</div></div>
          <div class="model" style="margin-top:12px"><div class="fs" style="font-family:var(--mono);font-size:11px"><b>Under the hood</b><br>Trigger { outcome:'task', triggerType:'schedule', workType:'${sc.workType === 'pm' ? 'preventive_maintenance' : sc.workType === 'calibration' ? 'calibration' : 'routine_check'}', dueBasis:'${sc.basis}', recurrence, calendarAnchor:'${sc.anchor === 'last' ? 'from_last_service' : 'fixed'}', performedBy:'${sc.performedBy}'${sc.meter ? `, meterTagId:'${sc.meter.tag}', meterIntervalHours:${sc.meter.hours}` : ''}${sc.statutory ? ', statutory:true' : ''}${sc.tolerance != null ? `, toleranceDays:${sc.tolerance}` : ''}${sc.probe ? `, displaySensorId:'${sc.probe}'` : ''} }<br>Clocks derived: deadline ${fmtH(c.deadline)} = ${sc.statutory ? '0' : sc.tolerance != null ? 'toleranceDays' : TIER_SHARE[tier] * 100 + '% × interval'}; start by = half.${leadOk ? '<br>Grant: approve.schedule (one added permission line, L3+).' : ''}</div></div>
        </div></div></div>`;
      const foot = readOnly ? `<span class="grow">Read-only.</span><button class="btn" id="sCancel">Close</button>` : `<span class="grow">${errs ? `${plural(errs, 'thing')} to fix.` : 'A draft never emits work.'}</span>${!isNew && !leadOk ? '<button class="btn ghost danger" id="sDelete">Delete</button>' : ''}${!isNew ? `<button class="btn" id="sPause">${sc.status === 'paused' ? 'Resume' : 'Pause'}</button>` : ''}${leadOk ? '' : '<button class="btn" id="sDraft">Save draft</button>'}<button class="btn primary" id="sSave" ${errs ? 'disabled' : ''}>${leadOk ? 'Save from next occurrence' : sc.status === 'active' ? 'Save' : 'Activate'}</button>`;
      sheetFrame(el, isNew ? `New schedule on ${esc(subjectName(sc.subject))}` : esc(sc.name), `${cap(sc.subject.kind === 'eq' ? 'machine' : sc.subject.kind)} · ${esc(subjectName(sc.subject))}${!isNew ? ` · <span class="chip ${sc.status === 'active' ? 'ok' : 'draft'}">${cap(sc.status)}</span>` : ''}`, body, foot, true);
      const rr = () => draw();
      $('#sName', el).oninput = (e) => { sc.name = e.target.value; };
      segWire(el, 'sWT', (v) => { sc.workType = v; if (v !== 'calibration') sc.probe = null; if (v === 'pm' && isNew) sc.anchor = 'last'; rr(); });
      $('#sProbe', el) && ($('#sProbe', el).onchange = (e) => { sc.probe = e.target.value || null; if (!sc.name) sc.name = sensor(sc.probe).name + ' calibration'; rr(); });
      $('#sFlow', el).onchange = (e) => { sc.flow = e.target.value || null; rr(); };
      segWire(el, 'sBasis', (v) => { sc.basis = v; if (v !== 'calendar' && !sc.meter) sc.meter = { tag: meters[0].id, hours: 500, last: meters[0].reading }; if (v === 'calendar') sc.meter = null; rr(); });
      $('#sN', el) && ($('#sN', el).onchange = (e) => { sc.every.n = Math.max(1, +e.target.value); rr(); });
      $('#sUnit', el) && ($('#sUnit', el).onchange = (e) => { sc.every.unit = e.target.value; rr(); });
      $('#sAnchor', el) && ($('#sAnchor', el).onchange = (e) => { sc.anchor = e.target.value; rr(); });
      $('#sHours', el) && ($('#sHours', el).onchange = (e) => { sc.meter.hours = +e.target.value; rr(); });
      $('#sMeter', el) && ($('#sMeter', el).onchange = (e) => { sc.meter.tag = e.target.value; });
      $('#sNext', el).onchange = (e) => { sc.nextDue = e.target.value; rr(); };
      segWire(el, 'sBy', (v) => { sc.performedBy = v; rr(); });
      $('#sVendor', el) && ($('#sVendor', el).oninput = (e) => { sc.vendor = e.target.value; });
      $('#sStat', el).onchange = (e) => { sc.statutory = e.target.checked; rr(); };
      $('#sTol', el) && ($('#sTol', el).onchange = (e) => { sc.tolerance = e.target.value === '' ? null : +e.target.value; rr(); });
      $('#sVerify', el) && ($('#sVerify', el).onchange = (e) => { sc.verify = e.target.checked; rr(); });
      $('#sCancel', el) && ($('#sCancel', el).onclick = closeSheet);
      const save = (status) => { sc.status = status; if (isNew) d.schedules.push(sc); else Object.assign(schedById(sc.id), sc); audit(`${isNew ? 'Added' : 'Saved'} schedule ${sc.name} on ${subjectName(sc.subject)}${leadOk ? ' from the equipment card' : ''}`, `${WT_LABEL[sc.workType]} · ${every(sc)} · next ${sc.nextDue}${leadOk && sc.open ? ' · applies from the next occurrence' : ''}`); closeSheet(); render(); toast(leadOk ? `Saved. ${sc.open ? "Today's task is unchanged; this applies from the next one." : 'Applies from the next occurrence.'}` : status === 'active' ? `${esc(sc.name)} is active. Next due ${esc(sc.nextDue)}.` : 'Saved as a draft.'); };
      $('#sDraft', el) && ($('#sDraft', el).onclick = () => save('draft'));
      $('#sSave', el) && ($('#sSave', el).onclick = () => save(leadOk ? schedById(sc.id).status : 'active'));
      $('#sPause', el) && ($('#sPause', el).onclick = () => { const t = schedById(sc.id); t.status = t.status === 'paused' ? 'active' : 'paused'; audit(`${t.status === 'paused' ? 'Paused' : 'Resumed'} ${t.name} on ${subjectName(t.subject)}`, t.status === 'paused' ? 'No next occurrence is emitted; an open one stays open' : ''); closeSheet(); render(); toast(t.status === 'paused' ? 'Paused. An open occurrence stays open; nothing new is emitted.' : 'Resumed.'); });
      $('#sDelete', el) && ($('#sDelete', el).onclick = () => { const i = d.schedules.findIndex((x) => x.id === sc.id); const r = d.schedules.splice(i, 1)[0]; audit(`Deleted schedule ${sc.name}`, ''); closeSheet(); render(); toast(`Deleted ${esc(sc.name)}.`, () => d.schedules.splice(i, 0, r)); });
    };
    draw();
  }
  function validateSchedule(sc) {
    const out = [];
    if (!sc.name.trim()) out.push({ level: 'err', text: 'Give it a name.' });
    if (sc.workType === 'calibration' && !sc.probe) out.push({ level: 'err', text: 'A calibration needs the probe it calibrates.' });
    if (sc.basis !== 'calendar' && !sc.meter) out.push({ level: 'err', text: 'A run-hours schedule needs a meter.' });
    if (sc.workType === 'pm' && sc.subject.kind !== 'eq') out.push({ level: 'err', text: 'Preventive maintenance needs the machine it maintains.' });
    if (sc.flow && flow(sc.flow).kind !== 'action') out.push({ level: 'err', text: 'A schedule runs an action flow, not a diagnostic.' });
    if (sc.verify && !leads().length) out.push({ level: 'err', text: 'Sign-off needs a Lead on the roster.' });
    if (!sc.flow) out.push({ level: 'warn', text: 'No steps attached — the operator sees open → done. Fine for a refill; thin for a bearing service.' });
    else out.push({ level: 'ok', text: `Runs ${flow(sc.flow).name} (${flow(sc.flow).steps.length} steps).` });
    if (sc.basis === 'either') out.push({ level: 'ok', text: 'Due on whichever comes first; the task records which leg fired.' });
    if (sc.performedBy === 'vendor') out.push({ level: 'ok', text: 'Closes with a photo of the vendor\'s service report; a missed visit goes overdue in the vendor\'s name.' });
    return out;
  }

  /* condition-based work editor */
  function shWork(el) {
    const d = D(), sub = parseNode(S.node), isNew = !S.sheet.id;
    const w = isNew ? { id: uid('w'), name: '', subject: sub, sensor: null, doWhen: null, doneWhen: null, flow: null, escalate: null, status: 'draft', open: 0 } : clone(workById(S.sheet.id));
    const readOnly = !can('equipment');
    const cands = sensorsOf(w.subject).filter((s) => s.kind === 'process' || s.kind === 'computed' || s.kind === 'analytical');
    if (!w.sensor && cands.length) w.sensor = cands[0].id;
    const draw = () => {
      const s = sensor(w.sensor);
      const tier = subjectTier(w.subject);
      const actionFlows = d.flows.filter((f) => f.status === 'published' && f.kind === 'action');
      const checks = [];
      if (!w.name.trim()) checks.push({ level: 'err', text: 'Give it a name.' });
      if (w.doWhen == null || w.doneWhen == null) checks.push({ level: 'err', text: 'Both thresholds are needed: when to do it, and what the sensor reads when it is done.' });
      else if (w.doneWhen >= w.doWhen) checks.push({ level: 'err', text: `"Done" (${w.doneWhen}) must be below "do it" (${w.doWhen}), or a reading resting on the line asks for the job on every poll.` });
      else if ((w.doWhen - w.doneWhen) < (s.valid[1] - s.valid[0]) * 0.02) checks.push({ level: 'warn', text: 'The gap is under 2% of the sensor range — normal noise may re-arm it without any work done.' });
      else checks.push({ level: 'ok', text: `Asks once when ${s.name} passes ${w.doWhen}; asks again only after it has dropped below ${w.doneWhen}.` });
      if (!w.flow) checks.push({ level: 'err', text: 'Condition-based work needs the steps that do it.' }); else checks.push({ level: 'ok', text: `Runs ${flow(w.flow).name}.` });
      if (w.escalate) { if (w.escalate.at <= w.doWhen) checks.push({ level: 'err', text: 'The issue threshold must be worse than the job threshold.' }); else checks.push({ level: 'ok', text: `Raises a ${SEV_LABEL[w.escalate.severity]} issue above ${w.escalate.at} ${s.unit} — the process not keeping up.` }); }
      else checks.push({ level: 'warn', text: 'No issue above a worse threshold. If this job is ignored, nothing raises an alarm until someone notices by eye.' });
      const errs = checks.filter((c) => c.level === 'err').length;
      if (isNew && !w.name) w.name = `${flow(w.flow) ? flow(w.flow).name : 'Job'} when ${s.name.toLowerCase()} builds`;
      const tc = taskClocks({ statutory: false, every: { n: 1, unit: 'day' }, basis: 'condition' }, tier);
      const body = `<div class="two"><div>
        <div class="fs"><div class="t"><span class="n">1</span>The job</div>
          <div class="f"><label class="l">Name</label><input type="text" id="wName" value="${esc(w.name)}" ${readOnly ? 'disabled' : ''}></div>
          <div class="f"><label class="l">Steps</label><select id="wFlow" ${readOnly ? 'disabled' : ''}><option value="">—</option>${actionFlows.map((f) => `<option value="${f.id}" ${w.flow === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div></div>
        <div class="fs"><div class="t"><span class="n">2</span>When the plant asks for it</div>
          <div class="f"><label class="l">Sensor</label><select id="wSensor" ${readOnly ? 'disabled' : ''}>${cands.map((c) => `<option value="${c.id}" ${c.id === w.sensor ? 'selected' : ''}>${esc(c.name)} (${esc(c.unit)})</option>`).join('')}</select></div>
          <div class="inl" style="margin-bottom:8px">Do it when the reading goes above <input type="number" step="any" id="wDo" value="${w.doWhen ?? ''}" ${readOnly ? 'disabled' : ''}> ${esc(s.unit)}</div>
          <div class="inl">It is done when the reading is back below <input type="number" step="any" id="wDone" value="${w.doneWhen ?? ''}" ${readOnly ? 'disabled' : ''}> ${esc(s.unit)}</div>
          <div class="h">The second number is what the sensor does when the work is done. After the operator finishes, the sensor is watched: if it did not clear, the job still closes but is graded "condition persisted".</div></div>
        <div class="fs"><div class="t"><span class="n">3</span>If it gets worse</div>
          <label class="toggle" style="margin-bottom:8px"><input type="checkbox" id="wEsc" ${w.escalate ? 'checked' : ''} ${readOnly ? 'disabled' : ''}> <span>Also raise an issue above a worse threshold</span></label>
          ${w.escalate ? `<div class="inl">Above <input type="number" step="any" id="wEscAt" value="${w.escalate.at}" ${readOnly ? 'disabled' : ''}> ${esc(s.unit)} raise a <div class="seg sm" id="wSev">${['minor', 'major'].map((k) => `<button data-v="${k}" aria-pressed="${w.escalate.severity === k}" ${readOnly ? 'disabled' : ''}>${SEV_LABEL[k]}</button>`).join('')}</div> issue</div><div class="h">Creates a real alert with its own page. Late routine work is not a plant problem; the process failing to keep up is. Emergency is not offered here.</div>` : ''}</div>
        <div class="fs"><div class="t"><span class="n">4</span>Who is told</div>${toldBlock([['When asked', `${names(ops())} — in the app`], [`Not started in ${fmtH(tc.start)}`, `${names(ops())}${tier === 'A' ? ' — WhatsApp' : ''}`], [`Overdue after ${fmtH(tc.deadline)}`, `${names(ops())} · ${names(leads())} — WhatsApp`], ['Ignored 5 times in a row', `${names(leads())} — one issue about this rule, not about the plant`]])}</div>
        <div class="fs"><div class="t"><span class="n">✓</span>Ready?</div><div class="checks">${checks.map((c) => `<div class="c ${c.level}">${c.level === 'ok' ? '✓' : c.level === 'err' ? '✕' : '!'} <span>${c.text}</span></div>`).join('')}</div></div>
        </div><div><div class="side"><div class="preview dark"><div class="ph">What the operator sees</div><div class="ti">${esc(w.name)}</div><div class="rd">${s.reading} <span class="u">${esc(s.unit)}</span></div><div class="mt">${esc(subjectName(w.subject))} · asked because ${esc(s.name.toLowerCase())} passed ${w.doWhen ?? '?'} ${esc(s.unit)}</div><div class="cta">Start task →</div></div>
        <div class="model" style="margin-top:12px"><div class="fs" style="font-family:var(--mono);font-size:11px"><b>Under the hood</b><br>Trigger { outcome:'task', triggerType:'alert' } → routine by derivation. observationConditionId (${esc(s.tag)} &gt; ${w.doWhen}), rearmConditionId (&lt; ${w.doneWhen}), clearanceCheckMinutes, chronicIgnoreThreshold:5${w.escalate ? `, promotionPairOf → Trigger{outcome:'issue', band ${w.escalate.severity} at ${w.escalate.at}}` : ''}. Clocks: condition-triggered tier ${tier} (${fmtH(tc.start)} / ${fmtH(tc.deadline)}).</div></div></div></div></div>`;
      const foot = readOnly ? `<span class="grow">Read-only.</span><button class="btn" id="wCancel">Close</button>` : `<span class="grow">${errs ? `${plural(errs, 'thing')} to fix.` : ''}</span>${!isNew ? '<button class="btn ghost danger" id="wDelete">Delete</button>' : ''}<button class="btn primary" id="wSave" ${errs ? 'disabled' : ''}>${isNew ? 'Activate' : 'Save'}</button>`;
      sheetFrame(el, isNew ? `New condition-based work on ${esc(subjectName(w.subject))}` : esc(w.name), esc(subjectName(w.subject)), body, foot, true);
      const rr = () => draw();
      $('#wName', el).oninput = (e) => { w.name = e.target.value; };
      $('#wFlow', el).onchange = (e) => { w.flow = e.target.value || null; rr(); };
      $('#wSensor', el).onchange = (e) => { w.sensor = e.target.value; w.name = ''; rr(); };
      $('#wDo', el).onchange = (e) => { w.doWhen = e.target.value === '' ? null : +e.target.value; rr(); };
      $('#wDone', el).onchange = (e) => { w.doneWhen = e.target.value === '' ? null : +e.target.value; rr(); };
      $('#wEsc', el).onchange = (e) => { w.escalate = e.target.checked ? { at: w.doWhen != null ? Math.round(w.doWhen * 1.5 * 100) / 100 : null, severity: 'minor', alert: null } : null; rr(); };
      $('#wEscAt', el) && ($('#wEscAt', el).onchange = (e) => { w.escalate.at = +e.target.value; rr(); });
      segWire(el, 'wSev', (v) => { w.escalate.severity = v; rr(); });
      $('#wCancel', el) && ($('#wCancel', el).onclick = closeSheet);
      $('#wSave', el) && ($('#wSave', el).onclick = () => {
        w.status = 'active';
        if (w.escalate && !w.escalate.alert) { const a = { id: uid('a'), name: `${s.name} — not keeping up`, subject: w.subject, sensor: w.sensor, limits: 'custom', custom: { caution: null, minor: null, major: null, emergency: null }, direction: 'above', holdMin: 10, closes: { mode: 'sensor', back: w.doneWhen, holdMin: 10 }, flow: null, verify: false, status: 'active', open: 0, pairOf: w.id }; a.custom[w.escalate.severity] = w.escalate.at; d.alerts.push(a); w.escalate.alert = a.id; }
        if (isNew) d.conditionWork.push(w); else Object.assign(workById(w.id), w);
        audit(`${isNew ? 'Added' : 'Saved'} condition-based work ${w.name}`, `${s.name} > ${w.doWhen}, done < ${w.doneWhen}${w.escalate ? ' · paired issue at ' + w.escalate.at : ''}`); closeSheet(); render(); toast(`${esc(w.name)} is active${w.escalate ? ' and its paired issue was created' : ''}.`);
      });
      $('#wDelete', el) && ($('#wDelete', el).onclick = () => { const i = d.conditionWork.findIndex((x) => x.id === w.id); const r = d.conditionWork.splice(i, 1)[0]; audit(`Deleted ${w.name}`, ''); closeSheet(); render(); toast('Deleted.', () => d.conditionWork.splice(i, 0, r)); });
    };
    draw();
  }

  /* sensor sheet — limits, valid range, calibration */
  function shSensor(el) {
    const d = D(), s = clone(sensor(S.sheet.id)), readOnly = !can('equipment');
    const home = sensorHome(s);
    const users = d.alerts.filter((a) => a.sensor === s.id), frozenUsers = users.filter((a) => a.open > 0 && a.limits === 'sensor');
    const draw = () => {
      const lim = s.limits || { caution: null, minor: null, major: null, emergency: null };
      const cal = d.schedules.find((x) => x.workType === 'calibration' && x.probe === s.id);
      const body = `
        ${frozenUsers.length ? `<div class="note warn" style="margin-bottom:14px"><span><b>${frozenUsers.map((a) => esc(a.name)).join(', ')} ${frozenUsers.length === 1 ? 'has' : 'have'} open records.</b> Changed limits reach ${frozenUsers.length === 1 ? 'it' : 'them'} only after those close; until then ${frozenUsers.length === 1 ? 'it' : 'they'} show as diverged.</span></div>` : ''}
        <div class="two"><div>
        <div class="fs"><div class="t">Reading now</div><div class="inl"><span class="mono" style="font-size:22px">${s.kind === 'status' ? (s.reading ? 'ON' : 'OFF') : s.reading} ${esc(s.unit)}</span>${s.state === 'stale' ? '<span class="chip warn">Stale — last sample 47 min ago</span>' : s.state === 'not_trusted' ? '<span class="chip err">Not trusted · alerts paused</span>' : '<span class="chip ok">Live</span>'}</div>${s.kind === 'computed' ? `<div class="h">Computed: ${esc(s.expr)}. If any input is stale this value is degraded and alerts on it pause.</div>` : ''}${s.setpoint ? `<div class="h">PLC set point <b>${s.setpoint.value} ${esc(s.unit)}</b> · ${esc(s.setpoint.tag)} — changed in Remote Control, shown here so limits and control agree.</div>` : ''}</div>
        ${s.kind !== 'meter' && s.kind !== 'status' ? `<div class="fs"><div class="t">Limits <span class="hint">used by ${plural(users.filter((a) => a.limits === 'sensor').length, 'alert')} that follow this sensor</span></div>
          <div class="f"><span class="l">Worse when the reading</span><div class="seg" id="snDir"><button data-v="below" aria-pressed="${s.direction === 'below'}" ${readOnly ? 'disabled' : ''}>Falls</button><button data-v="above" aria-pressed="${s.direction === 'above'}" ${readOnly ? 'disabled' : ''}>Rises</button></div><div class="h">Watching both directions is two sets of limits on two alerts; "worse" has to mean one thing.</div></div>
          <div class="limitgrid">${SEVS.slice().reverse().map((k) => `<div class="lab"><span class="sev ${k}">${SEV_LABEL[k]}</span></div><div><input type="number" step="any" data-lim="${k}" value="${lim[k] ?? ''}" placeholder="—" ${readOnly ? 'disabled' : ''}></div><div class="sk">${k === 'emergency' ? 'phone call + hooter' : k === 'major' ? 'full-screen alarm' : k === 'minor' ? 'WhatsApp' : 'in-app only'}</div>`).join('')}</div>
          <div class="f inline" style="margin-top:12px"><div><label class="l">Instrument reads from</label><div class="inl"><input type="number" step="any" id="snMin" value="${s.valid[0]}" ${readOnly ? 'disabled' : ''}> to <input type="number" step="any" id="snMax" value="${s.valid[1]}" ${readOnly ? 'disabled' : ''}> ${esc(s.unit)}</div><div class="h">Anything outside is a sensor fault: refused, never an alert, never a close.</div></div></div>
          </div>` : s.kind === 'status' ? `<div class="fs"><div class="t">Contact</div><div class="h">A boolean contact. The alert on it fires on the first ON reading; there is no hold time.</div></div>` : `<div class="fs"><div class="t">Meter</div><div class="h">Run-hours accumulate and never come back down, so a meter drives schedules (every 500 h) and is never an alert.</div></div>`}
        ${s.kind === 'analytical' ? `<div class="fs"><div class="t">Calibration and cleaning</div>${cal ? `<div class="ro">${esc(cal.name)} — ${every(cal)}, by ${cal.performedBy === 'vendor' ? esc(cal.vendor || 'vendor') : 'in-house'} · next ${esc(cal.nextDue)}</div>` : `<div class="note warn"><span>No calibration schedule. A probe that drifts raises false alarms and hides real ones.</span></div>`}
          <div class="f inline" style="margin-top:10px"><div><label class="l">Maintained by</label><select id="snBy" ${readOnly ? 'disabled' : ''}><option value="in_house" ${!s.calibration || s.calibration.by === 'in_house' ? 'selected' : ''}>In-house</option><option value="vendor" ${s.calibration && s.calibration.by === 'vendor' ? 'selected' : ''}>Vendor under contract</option></select></div><div>${s.calibration && s.calibration.by === 'vendor' ? `<label class="l">Vendor · contract ends</label><div class="inl"><input type="text" value="${esc(s.calibration.vendor || '')}" ${readOnly ? 'disabled' : ''}> <input type="date" value="${esc(s.calibration.contractEnd || '')}" ${readOnly ? 'disabled' : ''}></div><div class="h">The Lead is warned 30 days before it ends. Each contracted visit is a task in the vendor's name.</div>` : ''}</div></div>
          ${!cal && !readOnly ? '<button class="btn sm" id="snAddCal">Add calibration schedule</button>' : ''}</div>` : ''}
        <div class="fs"><div class="t">Report a fault</div><div class="h">An operator can say "this sensor is wrong" from the card. That pauses every alert on it at once, opens a sensor-fault issue on ${esc(home.name)} for the Technical Admin and the Lead, and never counts against the machine.</div></div>
        </div><div><div class="side"><div class="fs"><div class="t">Alerts using this sensor</div>${users.length ? users.map((a) => `<div style="margin-bottom:6px"><b>${esc(a.name)}</b> <span class="small muted">${a.limits === 'sensor' ? 'follows these limits' : 'has its own limits'}${a.open ? ' · open record' : ''}</span></div>`).join('') : '<div class="muted small">None yet.</div>'}</div>
          <div class="model" style="margin-top:12px"><div class="fs" style="font-family:var(--mono);font-size:11px"><b>Under the hood</b><br>Sensor { validMin:${s.valid[0]}, validMax:${s.valid[1]}, defaultZones:{ direction:'${s.direction}', zones:[${SEVS.filter((k) => lim[k] != null).map((k) => `{${k}:${lim[k]}}`).join(',')}] }${s.calibration ? `, maintenanceContract:{ maintainer:'${s.calibration.by}' }` : ''} }<br>Each zone mints or reuses a SignalCondition; following Triggers re-threshold live (FR-COND-07).</div></div></div></div></div>`;
      const foot = readOnly ? `<button class="btn" id="snClose">Close</button>` : `<span class="grow">Saving re-thresholds ${plural(users.filter((a) => a.limits === 'sensor' && !a.open).length, 'alert')} now; the change is audited.</span><button class="btn" id="snClose">Cancel</button><button class="btn primary" id="snSave">Save limits</button>`;
      sheetFrame(el, `${esc(s.name)} <span class="muted mono" style="font-weight:500">${esc(s.tag)}</span>`, `on ${esc(home.name)} · ${esc(stage(home.stage).name)}`, body, foot, true);
      segWire(el, 'snDir', (v) => { s.direction = v; draw(); });
      $$('[data-lim]', el).forEach((i) => i.onchange = () => { if (!s.limits) s.limits = { caution: null, minor: null, major: null, emergency: null }; s.limits[i.dataset.lim] = i.value === '' ? null : +i.value; });
      $('#snMin', el) && ($('#snMin', el).onchange = (e) => { s.valid[0] = +e.target.value; });
      $('#snMax', el) && ($('#snMax', el).onchange = (e) => { s.valid[1] = +e.target.value; });
      $('#snBy', el) && ($('#snBy', el).onchange = (e) => { s.calibration = { ...(s.calibration || {}), by: e.target.value }; draw(); });
      $('#snAddCal', el) && ($('#snAddCal', el).onclick = () => { Object.assign(sensor(s.id), s); S.node = 'eq:' + home.id; openSheet({ kind: 'schedule', id: null, presetCal: s.id }); });
      $('#snClose', el).onclick = closeSheet;
      $('#snSave', el) && ($('#snSave', el).onclick = () => {
        const lim2 = s.limits || {}; const set = SEVS.filter((k) => lim2[k] != null);
        for (let i = 1; i < set.length; i++) { const a1 = lim2[set[i - 1]], a2 = lim2[set[i]]; if (s.direction === 'below' ? a2 >= a1 : a2 <= a1) { toast(`${SEV_LABEL[set[i]]} must be ${s.direction === 'below' ? 'lower' : 'higher'} than ${SEV_LABEL[set[i - 1]]}.`); return; } }
        const bad = set.find((k) => lim2[k] < s.valid[0] || lim2[k] > s.valid[1]); if (bad) { toast(`${SEV_LABEL[bad]} limit is outside what the instrument can read.`); return; }
        const before = sensor(s.id); const diff = SEVS.filter((k) => (before.limits || {})[k] !== lim2[k]).map((k) => `${SEV_LABEL[k]} ${(before.limits || {})[k] ?? '—'} → ${lim2[k] ?? '—'}`).join(' · ');
        Object.assign(before, s); audit(`Changed limits on ${s.name} (${s.tag})`, `${diff || 'no change'} · ${plural(users.filter((a) => a.limits === 'sensor').length, 'alert')} follow this sensor`); closeSheet(); render(); toast(`Limits saved. ${plural(users.filter((a) => a.limits === 'sensor' && !a.open).length, 'alert')} re-thresholded.`);
      });
    };
    draw();
  }

  /* standard set review */
  function shStandard(el) {
    const d = D(), t = d.standardSets.find((x) => x.id === S.sheet.t), e = eq(parseNode(S.node).id);
    const sens = sensorsOf({ kind: 'eq', id: e.id });
    const alertsHere = d.alerts.filter((a) => a.subject.kind === 'eq' && a.subject.id === e.id);
    const rows = [];
    t.alerts.forEach((ta) => { const s = sens.find((x) => x.name === ta.sensorKind); const exists = alertsHere.some((a) => sensor(a.sensor).name === ta.sensorKind); rows.push({ kind: 'alert', ta, s, exists }); });
    t.schedules.forEach((ts) => { const exists = d.schedules.some((s) => s.subject.id === e.id && s.name === ts.name) || d.conditionWork.some((w) => w.subject.id === e.id && w.name === ts.name); const s = ts.sensorKind ? sens.find((x) => x.name === ts.sensorKind) : null; rows.push({ kind: 'sched', ts, s, exists }); });
    const body = `<div class="note teal" style="margin-bottom:14px"><span>Everything below is bound to <b>${esc(e.name)}</b> and its tags. Limits are the estate defaults — check them against this machine. Each one lands as a <b>draft</b>.</span></div>
      <div class="pick">${rows.map((r, i) => r.kind === 'alert' ? `<label style="${r.exists || !r.s ? 'opacity:.55' : ''}"><input type="checkbox" data-i="${i}" ${r.exists || !r.s ? 'disabled' : 'checked'}><div><b>${esc(r.ta.name)} <span class="chip">Alert</span></b><span>${r.s ? `${esc(r.s.name)} (${esc(r.s.tag)}) ${r.ta.direction === 'below' ? 'falls below' : 'rises above'} ${fmtLimits(r.ta.limits, r.ta.direction, r.s.unit)}${r.ta.flow ? ' · opens ' + esc(flow(r.ta.flow).name) : ''}` : `<span style="color:#8a5000">needs a ${esc(r.ta.sensorKind)} sensor on this machine — add the tag first</span>`}${r.exists ? ' · already here' : ''}</span></div></label>`
      : `<label style="${r.exists || (r.ts.workType === 'condition' && !r.s) ? 'opacity:.55' : ''}"><input type="checkbox" data-i="${i}" ${r.exists || (r.ts.workType === 'condition' && !r.s) ? 'disabled' : 'checked'}><div><b>${esc(r.ts.name)} <span class="chip">${WT_LABEL[r.ts.workType]}</span></b><span>${r.ts.workType === 'condition' ? (r.s ? `when ${esc(r.s.name)} > ${r.ts.doWhen}, done < ${r.ts.doneWhen}` : `<span style="color:#8a5000">needs a ${esc(r.ts.sensorKind)} sensor</span>`) : cap(every(r.ts)) + (r.ts.meterHours ? ' or ' + r.ts.meterHours + ' run-hours' : '')}${r.ts.flow ? ' · runs ' + esc(flow(r.ts.flow).name) : ''}${r.exists ? ' · already here' : ''}</span></div></label>`).join('')}</div>`;
    sheetFrame(el, `Standard set for ${esc(t.type)}`, `used at ${t.usedAt} plants · adding to ${esc(e.name)}`, body, `<span class="grow">Nothing fires until you check each draft and activate it.</span><button class="btn" id="stCancel">Cancel</button><button class="btn primary" id="stAdd">Add as drafts</button>`);
    $('#stCancel', el).onclick = closeSheet;
    $('#stAdd', el).onclick = () => {
      let n = 0;
      $$('input[data-i]:checked', el).forEach((cb) => { const r = rows[+cb.dataset.i]; n++;
        if (r.kind === 'alert') d.alerts.push({ id: uid('a'), name: `${r.ta.name} — ${e.tag}`, subject: { kind: 'eq', id: e.id }, sensor: r.s.id, limits: 'custom', custom: { caution: r.ta.limits.caution ?? null, minor: r.ta.limits.minor ?? null, major: r.ta.limits.major ?? null, emergency: r.ta.limits.emergency ?? null }, direction: r.ta.direction, holdMin: r.ta.limits.emergency != null ? 0 : 5, closes: r.s.kind === 'status' ? { mode: 'operator' } : { mode: 'sensor', back: r.ta.limits[entrySeverity(r.ta.limits)], holdMin: 10 }, flow: r.ta.flow || null, cause: r.ta.cause || null, verify: !!r.ta.limits.emergency, status: 'draft', open: 0, template: t.id.slice(2) });
        else if (r.ts.workType === 'condition') d.conditionWork.push({ id: uid('w'), name: r.ts.name, subject: { kind: 'eq', id: e.id }, sensor: r.s.id, doWhen: r.ts.doWhen, doneWhen: r.ts.doneWhen, flow: r.ts.flow, escalate: null, status: 'draft', open: 0 });
        else { const meter = sens.find((x) => x.kind === 'meter'); d.schedules.push({ id: uid('s'), name: r.ts.name, subject: { kind: 'eq', id: e.id }, workType: r.ts.workType, probe: r.ts.workType === 'calibration' ? (sens.find((x) => x.kind === 'analytical') || {}).id || null : null, flow: r.ts.flow || null, basis: r.ts.meterHours && meter ? 'either' : 'calendar', every: { ...r.ts.every }, meter: r.ts.meterHours && meter ? { tag: meter.id, hours: r.ts.meterHours, last: meter.reading } : null, anchor: r.ts.workType === 'pm' ? 'last' : 'fixed', nextDue: '2026-10-15', performedBy: 'in_house', statutory: false, verify: r.ts.workType === 'pm', status: 'draft', open: 0, template: t.id.slice(2) }); }
      });
      audit(`Added the ${t.type} standard set to ${e.name}`, `${plural(n, 'draft')} created; nothing fires until activated`); closeSheet(); render(); toast(`${plural(n, 'draft')} added to ${esc(e.name)}. Open each, check the numbers, activate.`);
    };
  }

  /* flow editor (lightweight) */
  function shFlow(el) {
    const d = D(), isNew = !S.sheet.id;
    const f = isNew ? { id: uid('f'), name: '', kind: S.sheet.newKind || 'action', forType: null, version: 1, status: 'draft', steps: [] } : clone(flow(S.sheet.id));
    const readOnly = !can('flows');
    const draw = () => {
      const stepRow = (st, i) => {
        const ans = st.answers ? Object.entries(st.answers).map(([k, v]) => `<span class="a ${v.t === 'cause' ? 'cause' : v.t === 'open' ? 'open' : ''}">${esc(k)} → ${v.t === 'step' ? 'step ' + v.id : v.t === 'cause' ? esc(cause(v.id).name) : 'not decided yet'}</span>`).join('') : '';
        return `<div class="step" data-i="${i}"><div class="n">${i + 1}</div><div><div class="t">${esc(st.text)}</div><div class="s">${cap(st.type)}${st.sensor ? ' · records ' + esc(sensor(st.sensor).name) : st.type === 'reading' ? ' · <span style="color:#8a5000">no tag bound — the number goes nowhere</span>' : ''}${st.minutes ? ' · ' + st.minutes + ' min' : ''}${st.photo ? ' · photo ' + st.photo : ''}${st.split != null ? ' · splits at ' + st.split : ''}</div>${ans ? `<div class="ans">${ans}</div>` : ''}</div><div class="actions">${readOnly ? '' : `<button class="btn sm" data-edit="${i}">Edit</button><button class="btn sm ghost danger" data-del="${i}">×</button>`}</div></div>`;
      };
      const runs = [...d.alerts.filter((x) => x.flow === f.id).map((x) => 'Alert · ' + x.name), ...d.schedules.filter((x) => x.flow === f.id).map((x) => 'Schedule · ' + x.name), ...d.conditionWork.filter((x) => x.flow === f.id).map((x) => 'Condition work · ' + x.name), ...d.causes.filter((x) => x.fix === f.id).map((x) => 'Fixes · ' + x.name)];
      const open = f.kind === 'diagnostic' ? f.steps.flatMap((st) => Object.values(st.answers || {})).filter((a) => a.t === 'open').length : 0;
      const noTag = f.steps.filter((st) => st.type === 'reading' && !st.sensor).length;
      const body = `<div class="two"><div>
        <div class="fs"><div class="t">${f.kind === 'diagnostic' ? 'Diagnostic flow' : 'Action flow'} <span class="hint">${f.kind === 'diagnostic' ? 'asks until it reaches a cause' : 'numbered steps, top to bottom'}</span></div>
          <div class="f inline"><div><label class="l">Name</label><input type="text" id="fName" value="${esc(f.name)}" ${readOnly ? 'disabled' : ''}></div><div><label class="l">For</label><select id="fFor" ${readOnly ? 'disabled' : ''}><option value="">Any machine</option>${[...new Set(d.equipment.map((e) => e.type))].map((t) => `<option ${f.forType === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div></div></div>
        <div class="fs"><div class="t">Steps <span class="hint">${f.steps.length} of 20</span></div><div class="steps" id="fSteps">${f.steps.map(stepRow).join('') || '<div class="muted small">No steps yet.</div>'}</div>
          ${readOnly ? '' : `<div class="actions" style="margin-top:10px"><button class="btn sm" data-add="instruction">+ Instruction</button><button class="btn sm" data-add="question">+ Question</button><button class="btn sm" data-add="reading">+ Reading</button><button class="btn sm" data-add="wait">+ Wait</button></div><div class="h">English only; Hindi is generated on publish. A reading binds to a tag so it lands on a chart and can be watched.</div>`}</div>
        <div class="fs"><div class="t">Ready to publish?</div><div class="checks">
          ${f.steps.length ? '<div class="c ok">✓ <span>Has steps.</span></div>' : '<div class="c err">✕ <span>Needs at least one step.</span></div>'}
          ${open ? `<div class="c warn">! <span>${plural(open, 'answer')} not decided yet — honest work in progress, blocks publish.</span></div>` : f.kind === 'diagnostic' ? '<div class="c ok">✓ <span>Every answer leads somewhere.</span></div>' : ''}
          ${noTag ? `<div class="c err">✕ <span>${plural(noTag, 'reading step')} not bound to a tag.</span></div>` : ''}
          ${f.kind === 'diagnostic' ? f.steps.flatMap((st) => Object.values(st.answers || {})).filter((a) => a.t === 'cause' && !cause(a.id).fix && !cause(a.id).sensorFault).map((a) => `<div class="c warn">! <span>${esc(cause(a.id).name)} has no action flow — the operator is told what is wrong and nothing about what to do.</span></div>`).join('') : ''}
          ${runs.length ? `<div class="c ok">✓ <span>Runs when: ${runs.map(esc).join(' · ')}</span></div>` : '<div class="c warn">! <span>Nothing runs this flow yet. Attach it from an alert, a schedule or a cause.</span></div>'}
        </div></div></div>
        <div><div class="side"><div class="preview dark"><div class="ph">Operator preview · step 1 of ${f.steps.length || 1}</div><div class="ti" style="font-size:16px">${esc(f.steps[0] ? f.steps[0].text : '—')}</div>${f.steps[0] && f.steps[0].type === 'question' ? '<div class="mt" style="margin-top:8px">[ Yes ] [ No ]</div>' : f.steps[0] && f.steps[0].type === 'reading' ? '<div class="rd">__._ <span class="u">' + esc(f.steps[0].sensor ? sensor(f.steps[0].sensor).unit : '') + '</span></div>' : ''}<div class="mt">Skip · Tell supervisor · Report</div><div class="cta">${f.steps[0] && f.steps[0].type === 'question' ? 'Answer' : 'Done →'}</div></div>
          <div class="fs" style="margin-top:12px"><div class="t">Versions</div><div class="small muted">v${f.version} ${f.status === 'published' ? 'published · records already open keep the version they started on' : 'draft'}</div></div>
          <div class="model" style="margin-top:12px"><div class="fs" style="font-family:var(--mono);font-size:11px"><b>Under the hood</b><br>Procedure { treeType:'${f.kind === 'diagnostic' ? 'branching' : 'linear'}', steps:[{ stepType STEP|NUMERIC|TIMER, responseType, answers:{ YES|NO|ABOVE|BELOW → step|cause+subject|open } }] } — answer owns its destination; outline derived.</div></div></div></div></div>`;
      const foot = readOnly ? `<button class="btn" id="fClose">Close</button>` : `<span class="grow">Draft saves skip every check.</span>${!isNew ? '<button class="btn ghost danger" id="fArchive">Archive</button>' : ''}<button class="btn" id="fDraft">Save draft</button><button class="btn primary" id="fPublish" ${(!f.steps.length || open || noTag) ? 'disabled' : ''}>Publish v${f.status === 'published' ? f.version + 1 : f.version}</button>`;
      sheetFrame(el, isNew ? `New ${f.kind} flow` : esc(f.name), `${cap(f.kind)} flow${f.forType ? ' · ' + esc(f.forType) : ''}`, body, foot, true);
      $('#fName', el).oninput = (e) => { f.name = e.target.value; };
      $('#fFor', el).onchange = (e) => { f.forType = e.target.value || null; };
      $$('[data-add]', el).forEach((b) => b.onclick = () => stepDialog({ id: (f.steps.at(-1)?.id || 0) + 1, type: b.dataset.add, text: '', answers: f.kind === 'diagnostic' && b.dataset.add !== 'instruction' && b.dataset.add !== 'wait' ? (b.dataset.add === 'question' ? { Yes: { t: 'open' }, No: { t: 'open' } } : { Above: { t: 'open' }, Below: { t: 'open' } }) : undefined }, (st) => { f.steps.push(st); draw(); }));
      $$('[data-edit]', el).forEach((b) => b.onclick = () => stepDialog(clone(f.steps[+b.dataset.edit]), (st) => { f.steps[+b.dataset.edit] = st; draw(); }));
      $$('[data-del]', el).forEach((b) => b.onclick = () => { f.steps.splice(+b.dataset.del, 1); draw(); });
      $('#fClose', el) && ($('#fClose', el).onclick = closeSheet);
      const save = (publish) => { if (publish) { f.status = 'published'; if (!isNew && flow(f.id).status === 'published') f.version++; } else if (f.status !== 'published') f.status = 'draft'; if (isNew) d.flows.push(f); else Object.assign(flow(f.id), f); audit(`${publish ? 'Published' : 'Saved'} ${f.name}${publish ? ' v' + f.version : ''}`, runs.length ? runs.length + ' things run it' : 'nothing runs it yet'); closeSheet(); render(); toast(publish ? `Published ${esc(f.name)} v${f.version}.${runs.length ? '' : ' Nothing runs it yet — attach it from an alert, a schedule or a cause.'}` : 'Saved as a draft.'); };
      $('#fDraft', el) && ($('#fDraft', el).onclick = () => save(false));
      $('#fPublish', el) && ($('#fPublish', el).onclick = () => save(true));
      $('#fArchive', el) && ($('#fArchive', el).onclick = () => { if (runs.length) { toast(`${plural(runs.length, 'thing')} still run this flow — re-point them first.`); return; } flow(f.id).status = 'archived'; closeSheet(); render(); toast('Archived. Nothing new can pick it.'); });
    };
    const stepDialog = (st, done) => {
      const d2 = D();
      const m = modal(`${st.text ? 'Edit' : 'Add'} ${st.type}`, `
        <div class="f"><label class="l">What the operator reads (English)</label><input type="text" id="stText" value="${esc(st.text)}" maxlength="100" placeholder="${st.type === 'question' ? 'Is the duty blower running?' : st.type === 'reading' ? 'Read the line pressure' : st.type === 'wait' ? 'Let the sludge settle' : 'Stop the rake and lock out'}"></div>
        ${st.type === 'reading' ? `<div class="f"><label class="l">Tag it records to</label><select id="stTag"><option value="">— not bound —</option>${d2.sensors.filter((s) => s.kind !== 'status').map((s) => `<option value="${s.id}" ${st.sensor === s.id ? 'selected' : ''}>${esc(s.name)} · ${esc(s.tag)} (${esc(s.unit)})</option>`).join('')}</select><div class="h">The tag supplies the unit and the valid range; the step stores none of them.</div></div>${st.answers ? `<div class="f"><label class="l">Split at</label><input type="number" step="any" id="stSplit" value="${st.split ?? ''}"></div>` : ''}` : ''}
        ${st.type === 'wait' ? `<div class="f"><label class="l">Minutes</label><input type="number" id="stMin" value="${st.minutes || 10}" min="1" max="1440"></div>` : ''}
        ${st.type === 'instruction' ? `<div class="f"><span class="l">Photo</span><div class="seg sm" id="stPhoto">${['none', 'optional', 'live', 'required'].map((p) => `<button data-v="${p}" aria-pressed="${(st.photo || 'none') === p}">${cap(p)}</button>`).join('')}</div><div class="h">Required and live can strand an operator with a dead camera. Use them where the image is the evidence someone will ask for.</div></div>` : ''}
        ${st.answers ? `<div class="f"><span class="l">Where each answer goes</span>${Object.keys(st.answers).map((k) => `<div class="inl" style="margin-bottom:6px"><span style="width:60px;font-weight:600">${esc(k)}</span><select data-ans="${k}"><option value="open" ${st.answers[k].t === 'open' ? 'selected' : ''}>not decided yet</option><optgroup label="Continue to step">${Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => n !== st.id).map((n) => `<option value="step:${n}" ${st.answers[k].t === 'step' && st.answers[k].id === n ? 'selected' : ''}>step ${n}</option>`).join('')}</optgroup><optgroup label="Conclude at a cause">${d2.causes.map((c) => `<option value="cause:${c.id}" ${st.answers[k].t === 'cause' && st.answers[k].id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup></select></div>`).join('')}<div class="h">A conclusion names a cause and, through it, the fix and the machine it appears on.</div></div>` : ''}`,
        [{ label: 'Cancel' }, { label: 'Save step', primary: true, fn: (mm) => { st.text = $('#stText', mm).value.trim(); if (!st.text) { $('#stText', mm).focus(); return true; } if ($('#stTag', mm)) st.sensor = $('#stTag', mm).value || null; if ($('#stSplit', mm)) st.split = $('#stSplit', mm).value === '' ? null : +$('#stSplit', mm).value; if ($('#stMin', mm)) st.minutes = +$('#stMin', mm).value; if ($('#stPhoto', mm)) st.photo = segVal(mm, 'stPhoto'); $$('[data-ans]', mm).forEach((s) => { const v = s.value; st.answers[s.dataset.ans] = v === 'open' ? { t: 'open' } : v.startsWith('step:') ? { t: 'step', id: +v.slice(5) } : { t: 'cause', id: v.slice(6) }; }); done(st); } }]);
      $$('#stPhoto button', m).forEach((b) => b.onclick = () => { $$('#stPhoto button', m).forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); });
    };
    draw();
  }

  /* cause sheet */
  function shCause(el) {
    const d = D(), isNew = !S.sheet.id, c = isNew ? { id: uid('c'), name: '', stage: null, type: null, fix: null } : clone(cause(S.sheet.id));
    const readOnly = !can('flows');
    const dx = d.flows.filter((f) => f.kind === 'diagnostic' && f.steps.some((st) => Object.values(st.answers || {}).some((a) => a.t === 'cause' && a.id === c.id)));
    const near = isNew ? [] : d.causes.filter((x) => x.id !== c.id && x.name.toLowerCase().split(' ').filter((w) => w.length > 3).some((w) => c.name.toLowerCase().includes(w)));
    const body = `<div class="fs"><div class="f"><label class="l">Cause</label><input type="text" id="cName" value="${esc(c.name)}" ${readOnly ? 'disabled' : ''} placeholder="Membrane fouling"></div>
      <div class="f inline"><div><label class="l">Stage it belongs to</label><select id="cStage" ${readOnly ? 'disabled' : ''}><option value="">Any stage</option>${d.stages.map((s) => `<option value="${s.id}" ${c.stage === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div><div><label class="l">Machine type (optional)</label><select id="cType" ${readOnly ? 'disabled' : ''}><option value="">—</option>${[...new Set(d.equipment.map((e) => e.type))].map((t) => `<option ${c.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><div class="h">A type, never a machine. Which machine is decided per record, when someone diagnoses it.</div></div></div>
      <div class="f"><label class="l">Fixed by</label><select id="cFix" ${readOnly ? 'disabled' : ''}><option value="">— nothing yet —</option>${d.flows.filter((f) => f.kind === 'action' && f.status === 'published').map((f) => `<option value="${f.id}" ${c.fix === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select><div class="h">The action flow an operator runs after this cause is found. Without one they are told what is wrong and nothing about what to do.</div></div></div>
      <div class="fs"><div class="t">Where it is used</div><div class="small">${dx.length ? 'Diagnosed by ' + dx.map((f) => esc(f.name)).join(', ') : 'No diagnostic flow reaches it yet.'}${near.length ? `<div class="note warn" style="margin-top:8px"><span>Looks like ${near.map((n) => esc(n.name)).join(', ')} — one failure with two spellings splits every count.</span></div>` : ''}</div></div>
      <div class="model"><div class="fs" style="font-family:var(--mono);font-size:11px"><b>Under the hood</b><br>RootCause { name, unitProcessId, equipmentType?, anyStage?, remediationTreeId } — global only, never binds to a site.</div></div>`;
    sheetFrame(el, isNew ? 'New cause' : esc(c.name), 'Shared by every plant', body, readOnly ? '<button class="btn" id="cClose">Close</button>' : `<span class="grow">A cause in use cannot be deleted; rename it instead.</span><button class="btn" id="cClose">Cancel</button><button class="btn primary" id="cSave">Save</button>`);
    $('#cClose', el).onclick = closeSheet;
    $('#cSave', el) && ($('#cSave', el).onclick = () => { c.name = $('#cName', el).value.trim(); if (!c.name) return; c.stage = $('#cStage', el).value || null; c.type = $('#cType', el).value || null; c.fix = $('#cFix', el).value || null; if (isNew) d.causes.push(c); else Object.assign(cause(c.id), c); audit(`${isNew ? 'Added' : 'Saved'} cause ${c.name}`, c.fix ? 'fixed by ' + flow(c.fix).name : 'no fix yet'); closeSheet(); render(); toast('Saved.'); });
  }

  /* person sheet */
  function shPerson(el) {
    const d = D(), isNew = !S.sheet.id, p = isNew ? { id: uid('p'), name: '', role: 'l1', grant: null, phone: { verified: false, channel: null }, major: 'now', quiet: '22:00–06:00' } : clone(d.people.find((x) => x.id === S.sheet.id));
    const edit = can('people');
    const body = `<div class="fs"><div class="f"><label class="l">Name</label><input type="text" id="pName" value="${esc(p.name)}" ${edit ? '' : 'disabled'}></div>
      <div class="f"><span class="l">Role at this plant</span><div class="seg" id="pRole">${['l1', 'l3', 'l4', 'regular'].map((r) => `<button data-v="${r}" aria-pressed="${p.role === r}" ${edit ? '' : 'disabled'}>${ROLE_LABEL[r]}</button>`).join('')}</div><div class="h">One role per person, account-wide. Operators do the work; Leads approve and close; a Senior Lead oversees many plants; a client viewer reads.</div></div>
      <div class="f"><span class="l">Admin grant</span><div class="seg" id="pGrant"><button data-v="" aria-pressed="${!p.grant}" ${edit ? '' : 'disabled'}>None</button>${['people', 'tech', 'fullsite'].map((g) => `<button data-v="${g}" aria-pressed="${p.grant === g}" ${edit ? '' : 'disabled'}>${GRANT_LABEL[g]}</button>`).join('')}</div><div class="h">People Admin owns the roster, quiet hours and the hooter. Technical Admin owns equipment, alerts, schedules and flows.</div></div>
      <div class="f"><span class="l">Phone</span><div class="ro">${p.phone.verified ? `Verified over ${p.phone.channel === 'wa' ? 'WhatsApp' : 'SMS'} — alerts go there. The code they typed decided the channel; there is no picker.` : 'Not verified. They can log in and work, and hear about things only inside the app. Ask them to verify from their profile.'}</div></div></div>
      <div class="fs"><div class="t">Their own settings <span class="hint">read-only — nobody changes another person's settings</span></div><div class="small">Emergency: Now (locked) · Major: ${p.major === 'now' ? 'Now' : p.major === 'email' ? 'Morning email' : 'Off'} · Minor: Now · Caution: Morning email · Quiet hours ${esc(p.quiet)}</div><div class="h">If they turn Major down, every Lead and the People Admin are told.</div></div>`;
    sheetFrame(el, isNew ? 'Add person' : esc(p.name), isNew ? 'They get a code on their phone and verify it themselves' : `${ROLE_LABEL[p.role]}${p.grant ? ' · ' + GRANT_LABEL[p.grant] : ''}`, body, edit ? `<span class="grow">Removing the last reachable Operator or Lead is refused.</span>${!isNew ? '<button class="btn ghost danger" id="pRemove">Remove from plant</button>' : ''}<button class="btn" id="pClose">Cancel</button><button class="btn primary" id="pSave">${isNew ? 'Invite' : 'Save'}</button>` : '<button class="btn" id="pClose">Close</button>');
    segWire(el, 'pRole'); segWire(el, 'pGrant');
    $('#pClose', el).onclick = closeSheet;
    $('#pSave', el) && ($('#pSave', el).onclick = () => { p.name = $('#pName', el).value.trim(); if (!p.name) return; const oldRole = isNew ? null : d.people.find((x) => x.id === p.id).role; p.role = segVal(el, 'pRole'); p.grant = segVal(el, 'pGrant') || null; if (isNew) d.people.push(p); else Object.assign(d.people.find((x) => x.id === p.id), p); const g = gaps(); if (!g.reachOps.length || !g.reachLeads.length) { if (!isNew && oldRole) d.people.find((x) => x.id === p.id).role = oldRole; toast('Refused: that would leave no reachable ' + (!g.reachOps.length ? 'Operator' : 'Lead') + ' at the plant.'); render(); return; } audit(`${isNew ? 'Invited' : 'Saved'} ${p.name} as ${ROLE_LABEL[p.role]}`, p.grant ? GRANT_LABEL[p.grant] : ''); closeSheet(); render(); toast(isNew ? `${esc(p.name)} invited. They verify their phone with a code.` : 'Saved. A role change re-syncs their settings and is a named message to them.'); });
    $('#pRemove', el) && ($('#pRemove', el).onclick = () => { const i = d.people.findIndex((x) => x.id === p.id); const r = d.people.splice(i, 1)[0]; const g = gaps(); if (!g.reachOps.length || !g.reachLeads.length) { d.people.splice(i, 0, r); toast('Refused: that would leave no reachable ' + (!g.reachOps.length ? 'Operator' : 'Lead') + '. Alerts would reach nobody.'); return; } audit(`Removed ${p.name} from the plant`, ''); closeSheet(); render(); toast(`${esc(p.name)} removed.`, () => d.people.splice(i, 0, r)); });
  }

  /* ── boot ────────────────────────────────────────────────────────── */
  $('#persona').onchange = (e) => { S.persona = e.target.value; S.sheet = null; if (S.persona !== 'global' && route().view === 'standards') location.hash = '#/setup'; render(); };
  $('#reset').onclick = () => { S.d = clone(window.SEED); S.sheet = null; render(); toast('Reset to the starting data.'); };
  render();
})();
