/* CloseTheLoop · Configuration — proposal prototype, v2 (simplified by design).
   Core: state, helpers, derived facts, router, shell, guide panel, states.
   Views live in views.js, sheets in sheets.js. Everything is in memory. */
window.CTL = (function () {
  'use strict';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const S = {
    d: clone(window.SEED), persona: 'tech', model: false, guide: true, sheet: null,
    node: 'plant', treeFilter: '', openSec: null, skipped: new Set(), failNext: false, loadedRoutes: new Set(), emptyDemo: false,
  };
  try { const g = localStorage.getItem('ctl.guide'); if (g !== null) S.guide = g === '1'; } catch (e) { /* private mode */ }

  /* ── helpers ─────────────────────────────────────────────────── */
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
  const ROLE_LABEL = { l1: 'Operator', l3: 'Lead', l4: 'Senior Lead', regular: 'Client viewer' };
  const GRANT_LABEL = { people: 'People Admin', tech: 'Technical Admin', fullsite: 'Full Site Admin', global: 'Global Admin' };
  const WT_LABEL = { routine: 'Routine check', pm: 'Preventive maintenance', calibration: 'Calibration', condition: 'Condition-based work' };
  const PERSONA = {
    tech: { label: 'Technical Admin', who: 'Swadesh Singh', can: { equipment: true, flows: true, people: false, site: false, standards: false } },
    people: { label: 'People Admin', who: 'Kishore Reddy', can: { equipment: false, flows: false, people: true, site: true, standards: false } },
    lead: { label: 'Lead (L3)', who: 'Kishore Reddy', can: { equipment: false, flows: false, people: false, site: false, standards: false } },
    global: { label: 'Global Admin', who: 'Satyadev Singh', can: { equipment: true, flows: true, people: true, site: true, standards: true } },
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
  const sensorHome = (s) => eq(s.on.slice(3));
  const sensorsOf = (sub) => sub.kind === 'eq' ? D().sensors.filter((s) => s.on === 'eq:' + sub.id)
    : sub.kind === 'group' ? D().sensors.filter((s) => group(sub.id).members.includes(s.on.slice(3)))
    : sub.kind === 'stage' ? D().sensors.filter((s) => sensorHome(s).stage === sub.id) : D().sensors.slice();
  const limitsOfAlert = (a) => { const s = sensor(a.sensor); return { lim: a.limits === 'custom' ? a.custom : (s.limits || {}), dir: a.limits === 'custom' ? a.direction : (s.direction || 'below'), s }; };
  const entrySeverity = (lim) => SEVS.find((k) => lim && lim[k] != null) || null;
  const deepestSeverity = (lim) => SEVS.slice().reverse().find((k) => lim && lim[k] != null) || null;
  const limitsText = (lim, dir, unit) => SEVS.filter((k) => lim && lim[k] != null).map((k) => `${SEV_LABEL[k]} ${dir === 'below' ? '<' : '>'} ${lim[k]}${unit ? ' ' + unit : ''}`).join(' · ');
  const fmtLimits = (lim, dir, unit) => { const p = SEVS.filter((k) => lim && lim[k] != null).map((k) => `<span class="l ${k}">${SEV_LABEL[k]} ${dir === 'below' ? '<' : '>'} ${lim[k]}${unit ? ' ' + unit : ''}</span>`); return p.length ? `<span class="limits">${p.join('')}</span>` : '<span class="limits"><span class="none">no limits yet</span></span>'; };
  const every = (sch) => { const mh = sch.meter ? sch.meter.hours : sch.meterHours; const cal = `every ${sch.every.n === 1 ? '' : sch.every.n + ' '}${sch.every.unit}${sch.every.n > 1 ? 's' : ''}`; if (sch.basis === 'meter') return `every ${mh} run-hours`; if (sch.basis === 'either') return `${cal} or ${mh} run-hours`; return cal; };
  /* Default closing threshold: a little past the entry limit (5% of the instrument's range) so a reading resting on the limit does not flap. */
  const closeDefault = (s, dir, entry) => { if (!s || s.kind === 'status' || entry == null) return entry; const step = (s.valid[1] - s.valid[0]) * 0.05; const raw = dir === 'below' ? entry + step : entry - step; const p = step < 0.1 ? 1000 : step < 1 ? 100 : step < 10 ? 10 : 1; return Math.round(raw * p) / p; };
  const intervalHours = (sch) => sch.every.n * ({ day: 24, week: 168, month: 720, year: 8760 }[sch.every.unit] || 24);
  const taskClocks = (sch, tier) => { if (sch.statutory) return { deadline: 0, start: 0 }; const h = intervalHours(sch); const deadline = sch.tolerance != null ? sch.tolerance * 24 : Math.max(2, h * TIER_SHARE[tier]); return { deadline, start: Math.max(1, deadline / 2) }; };
  const fmtH = (h) => h == null ? '—' : h === 0 ? 'at once' : h >= 48 ? `${Math.round(h / 24 * 10) / 10} days` : h >= 24 ? `${Math.round(h / 24 * 10) / 10} day` : `${Math.round(h * 10) / 10} h`;
  const suggestedLimits = (s) => { for (const t of D().standardSets) { const a = t.alerts.find((x) => x.sensorKind === s.name); if (a) return { lim: { caution: a.limits.caution ?? null, minor: a.limits.minor ?? null, major: a.limits.major ?? null, emergency: a.limits.emergency ?? null }, dir: a.direction, from: t.usedAt }; } return null; };

  /* roster → who is told (Notifications Brief §4) */
  const people = () => D().people;
  const byRole = (r) => people().filter((p) => p.role === r);
  const ops = () => byRole('l1'), leads = () => byRole('l3'), seniors = () => byRole('l4');
  const seniorOrLeads = () => seniors().length ? seniors() : leads();
  const siteAdmins = () => people().filter((p) => p.grant === 'people' || p.grant === 'fullsite');
  const first = (list) => list.map((p) => p.name.split(' ')[0]).join(', ') || 'nobody';
  const roleWord = (list, w) => list.length ? `${list.length === 1 ? 'the ' + w : plural(list.length, w)} (${first(list)})` : `no ${w}`;
  function issueLadder(sev, clocks) {
    const [resp, dead] = clocks || SEV_CLOCK[sev];
    const O = roleWord(ops(), 'Operator'), L = roleWord(leads(), 'Lead'), SL = seniors().length ? roleWord(seniors(), 'Senior Lead') : L + ' again';
    if (sev === 'emergency') return [['Now', `everyone at the plant — phone call, hooter, full-screen alarm`], [`Not started in ${fmtH(resp)}`, `${L} and ${roleWord(seniors(), 'Senior Lead')} again`], [`Not fixed in ${fmtH(dead)}`, `everyone again · Site Admin by email`]];
    if (sev === 'major') return [['Now', `${O} and ${L} — WhatsApp and full-screen alarm`], [`Not started in ${fmtH(resp)}`, L], [`Not fixed in ${fmtH(dead)}`, `${SL} · Site Admin and client by email`]];
    if (sev === 'minor') return [['Now', `${O} — WhatsApp · ${L} in the app`], [`Not started in ${fmtH(resp)}`, L], [`Not fixed in ${fmtH(dead)}`, `${SL} · Site Admin and client by email`]];
    return [['Now', `${O} and ${L} — in the app and the morning email`], ['Later', 'nothing more. Caution never reminds.']];
  }
  const ladderSummary = (sev, clocks) => { const l = issueLadder(sev, clocks); return sev === 'caution' ? 'In the app only, never reminds' : `${cap(l[0][1].split(' — ')[0])} now · ${l[1][0].toLowerCase()}: ${l[1][1].split(' (')[0]}`; };
  function taskLadder(sch, tier) { const c = taskClocks(sch, tier); const loud = tier === 'A' || sch.statutory; const O = roleWord(ops(), 'Operator'), L = roleWord(leads(), 'Lead'); return [['When due', `${O} — in the app and the morning email`], [`Not started in ${fmtH(c.start)}`, loud ? `${O} — WhatsApp` : `${O} — in the app`], [`Overdue after ${fmtH(c.deadline)}`, `${O} and ${L} — WhatsApp${loud ? ' · ' + roleWord(seniors(), 'Senior Lead') : ''}`], ['Twice overdue', `everyone · Site Admin by email`]]; }
  const toldBlock = (rows) => `<div class="told">${rows.map(([w, p]) => `<div class="r"><div class="w">${esc(w)}</div><div class="p">${esc(p)}</div></div>`).join('')}</div>`;

  /* readiness */
  function gaps() {
    const d = D();
    const isProcess = (s) => s.kind !== 'meter' && s.kind !== 'status';
    const sensorsNoLimits = d.sensors.filter((s) => isProcess(s) && !(s.limits && SEVS.some((k) => s.limits[k] != null)));
    const hasProgramme = (e) => d.schedules.some((s) => s.subject.kind === 'eq' && s.subject.id === e.id && s.workType !== 'calibration') || d.conditionWork.some((w) => w.subject.id === e.id);
    const eqNeedingPM = d.equipment.filter((e) => e.expects.length && !hasProgramme(e));
    const probesNoCal = d.sensors.filter((s) => s.kind === 'analytical' && !d.schedules.some((x) => x.workType === 'calibration' && x.probe === s.id));
    const eqNoAlerts = d.equipment.filter((e) => d.standardSets.some((t) => t.type === e.type && t.alerts.length) && !d.alerts.some((a) => sensorHome(sensor(a.sensor)).id === e.id));
    const causesNoFix = d.causes.filter((c) => !c.fix && !c.sensorFault);
    const reachOps = ops().filter((p) => p.phone.verified), reachLeads = leads().filter((p) => p.phone.verified);
    const majorNow = ops().some((p) => p.major === 'now') && leads().some((p) => p.major === 'now');
    const routingOk = reachOps.length > 0 && reachLeads.length > 0 && majorNow;
    const routingWhy = !reachOps.length ? 'No Operator has a verified phone.' : !reachLeads.length ? 'No Lead has a verified phone.' : !majorNow ? 'Nobody at the plant has Major set to Now.' : '';
    const steps = [
      { id: 'people', title: 'People who can be reached', done: routingOk, count: routingOk ? 0 : 1 },
      { id: 'limits', title: 'Limits on every sensor', done: !sensorsNoLimits.length, count: sensorsNoLimits.length },
      { id: 'alerts', title: 'Alerts on every machine', done: !eqNoAlerts.length, count: eqNoAlerts.length },
      { id: 'schedules', title: 'A schedule for every machine', done: !eqNeedingPM.length && !probesNoCal.length, count: eqNeedingPM.length + probesNoCal.length },
      { id: 'flows', title: 'A fix for every cause', done: !causesNoFix.length, count: causesNoFix.length },
    ].map((st) => ({ ...st, skipped: S.skipped.has(st.id) }));
    const doneCount = steps.filter((s) => s.done || s.skipped).length;
    return { sensorsNoLimits, eqNeedingPM, probesNoCal, eqNoAlerts, causesNoFix, routingOk, routingWhy, reachOps, reachLeads, steps, doneCount, allDone: doneCount === steps.length };
  }
  const nodeStatus = (sub) => { const g = gaps(); const eqs = sub.kind === 'eq' ? [eq(sub.id)] : sub.kind === 'group' ? group(sub.id).members.map(eq) : sub.kind === 'stage' ? D().equipment.filter((e) => e.stage === sub.id) : D().equipment; const missing = eqs.some((e) => g.eqNeedingPM.includes(e) || g.eqNoAlerts.includes(e) || g.sensorsNoLimits.some((s) => s.on === 'eq:' + e.id) || g.probesNoCal.some((s) => s.on === 'eq:' + e.id)); const has = D().alerts.some((a) => eqs.some((e) => subjectKey(a.subject) === 'eq:' + e.id) || subjectKey(a.subject) === subjectKey(sub)) || D().schedules.some((s) => subjectKey(s.subject) === subjectKey(sub) || eqs.some((e) => subjectKey(s.subject) === 'eq:' + e.id)); return missing ? 'gap' : has ? 'ok' : 'none'; };

  /* ── feedback: toast, modal, audit, saving simulation ────────── */
  let toastT;
  function toast(msg, undo) { $('#toast')?.remove(); const el = document.createElement('div'); el.className = 'toast'; el.id = 'toast'; el.innerHTML = `<span>${msg}</span>${undo ? '<span class="u">Undo</span>' : ''}`; if (undo) el.querySelector('.u').onclick = () => { undo(); el.remove(); render(); }; document.body.appendChild(el); clearTimeout(toastT); toastT = setTimeout(() => el.remove(), 6500); }
  function audit(what, detail) { const n = new Date(); const ts = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')} ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; D().audit.unshift({ ts, who: PERSONA[S.persona].who, what, detail: detail || '' }); }
  function modal(title, body, actions) { $('#modal')?.remove(); const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; m.innerHTML = `<div class="box"><div class="h">${esc(title)}</div><div class="b">${body}</div><div class="ft">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`; document.body.appendChild(m); $$('.ft button', m).forEach((b) => b.onclick = () => { const a = actions[+b.dataset.i]; const keep = a.fn && a.fn(m); if (!keep) m.remove(); }); return m; }
  /* Simulated write: resolves after 500 ms; rejects once if "Make the next save fail" is on. */
  function save(fn) { return new Promise((res, rej) => setTimeout(() => { if (S.failNext) { S.failNext = false; rej(new Error('network')); } else { fn(); res(); } }, 500)); }

  /* ── guide panel ─────────────────────────────────────────────── */
  const GUIDE = {
    'setup': { t: 'Set up the plant', w: 'Five steps, in order. Each shows only what is missing and offers a recommended answer you can accept in one click.', y: 'A plant is ready when an alert reaches a person, every reading has limits, every machine is watched, every machine that needs a schedule has one, and every diagnosis leads to a fix.', s: 'You can skip any step and come back. The home page remembers where you were.' },
    'setup/people': { t: 'Step 1 · People', w: 'Check that at least one Operator and one Lead can be reached by phone.', y: 'Who is told is fixed by role and looked up from this roster the moment something fires. With nobody reachable, every alert goes nowhere.', s: 'This one cannot be skipped. Nothing else matters until it is green.' },
    'setup/limits': { t: 'Step 2 · Limits', w: 'Give each sensor its Caution, Minor, Major and Emergency thresholds. Suggested values come from plants with the same machine type.', y: 'Limits live on the sensor so every alert on it agrees, and so the operator card colours readings the same way.', s: 'A skipped sensor simply has no alert until you come back.' },
    'setup/alerts': { t: 'Step 3 · Alerts', w: 'Add the standard alerts for each machine type. They use the limits you just confirmed.', y: 'A standard set is what other plants already watch on this kind of machine. You are checking, not authoring.', s: 'An alert that cannot run yet (a missing sensor) is kept as a draft with the reason.' },
    'setup/schedules': { t: 'Step 4 · Schedules', w: 'Give every machine that needs a maintenance programme one, and every probe a calibration schedule.', y: 'Reminders and deadlines come from the machine\'s criticality and the cadence. Nothing to type.', s: 'A missing schedule is a planning gap, not a safety failure. Skip and the plant still alerts.' },
    'setup/flows': { t: 'Step 5 · Fixes', w: 'Link an action flow to each cause that has none.', y: 'A diagnosis without a fix tells the operator what is wrong and nothing about what to do.', s: 'Without a fix the operator closes with a photo or note. It works; it teaches nothing.' },
    'setup/done': { t: 'Ready', w: 'The plant is set up. From here you maintain it from the Equipment page.', y: 'Everything you accepted is editable on the machine it belongs to.', s: '' },
    'equipment': { t: 'Equipment', w: 'Pick a machine, a stage or the plant on the left. Everything about it is on one page, one section open at a time.', y: 'Admins think per machine. Each alert and schedule lives on the thing it is about.', s: 'An amber dot means something is missing on that machine. Grey means nothing is set up yet.' },
    'flows': { t: 'Flows', w: 'A diagnostic flow asks questions until it reaches a cause. An action flow is the numbered steps that do the work.', y: 'Alerts open diagnostic flows. Schedules and causes run action flows.', s: 'A flow nothing runs is fine while you write it; the list says so.' },
    'people': { t: 'People & alerts', w: 'Who holds which role, whether they can be reached, and the two site defaults.', y: 'This is the whole routing configuration. There is no chain to draw and no recipients to type.', s: 'Removing the last reachable Operator or Lead is refused.' },
    'activity': { t: 'Activity', w: 'Everything that changed who gets woken up, with before and after.', y: 'Kept 24 months.', s: '' },
    'standards': { t: 'Standard sets', w: 'One set per machine type: the alerts and schedules every plant with that machine should have.', y: 'A plant binds a set to a real machine and checks the numbers. Changing a set here reaches every plant that follows it.', s: '' },
    'sheet/alert/1': { t: 'Which reading?', w: 'Pick the sensor that shows the problem. The name fills itself in.', y: 'One alert watches one reading. Two directions or two sensors are two alerts.', s: '' },
    'sheet/alert/2': { t: 'When is it a problem?', w: 'The sensor\'s own limits are pre-filled. Change them only if this alert should differ from the sensor.', y: 'Each tier you fill in is a step up in who is told and how loudly. Blank tiers are skipped.', s: 'Leave "More options" alone unless a reading flaps or a planned shutdown raises it.' },
    'sheet/alert/3': { t: 'What happens next?', w: 'Say what closes it and what the operator should do.', y: 'A sensor closing it is honest; an operator closing it is honest when no sensor can see the fix. A clock is never honest.', s: 'No flow is fine: the operator gets a simple open → done issue.' },
    'sheet/alert/4': { t: 'Review', w: 'Read the sentence, check who is told, try a reading, then activate.', y: 'Nothing fires until you activate. A draft is safe to leave overnight.', s: '' },
    'sheet/schedule/1': { t: 'What work?', w: 'Routine check, preventive maintenance or calibration, and the steps the operator follows.', y: 'The kind decides the chip on the card and whether it counts toward maintenance coverage.', s: '' },
    'sheet/schedule/2': { t: 'How often?', w: 'A calendar, run-hours, or whichever comes first. From the last completion for wear-out work; fixed dates for rounds and statutory work.', y: 'Reminders come from this cadence and the machine\'s criticality. Nothing to type.', s: '' },
    'sheet/schedule/3': { t: 'Review', w: 'Check how urgent it is and who is told, then activate.', y: 'Planned work is quiet by design and gets louder only as it gets late.', s: '' },
    'sheet/work/1': { t: 'Which reading and job?', w: 'The plant asks for a job when a reading crosses a line: a backwash, a filter clean.', y: 'This is the process working, not failing, so it is a task, not an alert.', s: '' },
    'sheet/work/2': { t: 'When?', w: 'Two numbers: when to do it, and what the sensor reads when it is done.', y: 'The gap between them stops a reading resting on the line from asking on every poll.', s: 'Optionally raise an issue above a worse threshold, for when the job stops keeping up.' },
    'sheet/work/3': { t: 'Review', w: 'Check and activate.', y: '', s: '' },
    'sheet/sensor': { t: 'Sensor limits', w: 'Direction, then a threshold per tier. Blank tiers are skipped.', y: 'Every alert that follows this sensor changes with it. The change is audited.', s: '' },
    'sheet/standard': { t: 'Standard set', w: 'Untick anything that does not apply here, then add.', y: 'Everything lands bound to this machine and its tags.', s: 'Rows without the sensor they need are disabled with the reason.' },
    'sheet/flow': { t: 'Flow', w: 'Add steps in order. A question routes on its answer; a reading binds to a tag.', y: 'A conclusion names a cause, and the cause names its fix.', s: '' },
    'sheet/cause': { t: 'Cause', w: 'One estate-wide word for one failure, and what fixes it.', y: 'Thirty plants using one word is what makes "what goes wrong" countable.', s: '' },
    'sheet/person': { t: 'Person', w: 'One role, optionally one admin grant. They verify their own phone.', y: 'A role describes the person, not the plant.', s: '' },
  };
  function guideKey() { if (S.sheet) return S.sheet.step && GUIDE[`sheet/${S.sheet.kind}/${S.sheet.step}`] ? `sheet/${S.sheet.kind}/${S.sheet.step}` : `sheet/${S.sheet.kind}`; const r = route(); return r.view === 'setup' && r.rest[0] ? `setup/${r.rest[0]}` : r.view; }
  function renderGuide() {
    const key = guideKey(); const g = GUIDE[key] || GUIDE[key.split('/')[0]] || GUIDE.setup;
    const el = $('#guide'); el.classList.toggle('open', S.guide); document.body.classList.toggle('guide-open', S.guide);
    $('#guideBtn').setAttribute('aria-pressed', S.guide);
    el.innerHTML = `<div class="gh"><span class="eyebrow">Help</span><button class="x" id="guideClose" aria-label="Close help">×</button></div>
      <h3>${esc(g.t)}</h3><p>${esc(g.w)}</p>${g.y ? `<p class="why"><b>Why.</b> ${esc(g.y)}</p>` : ''}${g.s ? `<p class="skip"><b>If you skip.</b> ${esc(g.s)}</p>` : ''}
      <div class="gdemo"><div class="eyebrow">Try the hard cases</div>
        <label class="toggle"><input type="checkbox" id="failToggle" ${S.failNext ? 'checked' : ''}> <span>Make the next save fail</span></label>
        <label class="toggle"><input type="checkbox" id="emptyToggle" ${S.emptyDemo ? 'checked' : ''}> <span>Start from an empty plant</span></label>
        <label class="toggle"><input type="checkbox" id="modelToggle" ${S.model ? 'checked' : ''}> <span>Show the model underneath</span></label>
      </div>`;
    $('#guideClose').onclick = () => setGuide(false);
    $('#failToggle').onchange = (e) => { S.failNext = e.target.checked; };
    $('#modelToggle').onchange = (e) => { S.model = e.target.checked; document.body.classList.toggle('model', S.model); };
    $('#emptyToggle').onchange = (e) => { S.emptyDemo = e.target.checked; resetData(); location.hash = '#/setup'; render(); toast(S.emptyDemo ? 'Empty plant: no limits, no alerts, no schedules, no reachable Lead. Follow the setup.' : 'Back to the fully set-up plant.'); };
  }
  function setGuide(on) { S.guide = on; try { localStorage.setItem('ctl.guide', on ? '1' : '0'); } catch (e) { /* ignore */ } renderGuide(); }
  function resetData() { S.d = clone(window.SEED); S.skipped = new Set(); S.sheet = null; S.openSec = null; if (S.emptyDemo) { const d = S.d; d.alerts = []; d.schedules = []; d.conditionWork = []; d.milestones = []; d.sensors.forEach((s) => { if (s.kind !== 'status') s.limits = null; }); d.people.forEach((p) => { if (p.role === 'l3') p.phone = { verified: false, channel: null }; }); d.audit = [{ ts: '2026-09-29 09:00', who: 'Kishore Reddy', what: 'Plant created from the equipment module', detail: '12 machines, 22 sensors imported' }]; } }

  /* ── router and shell ────────────────────────────────────────── */
  function route() { const h = location.hash.replace(/^#\/?/, '') || 'setup'; const [view, ...rest] = h.split('/'); return { view, rest }; }
  window.addEventListener('hashchange', () => { S.sheet = null; render(); });
  function renderNav() {
    const { view } = route(); const g = gaps();
    const dot = (k) => k === 'err' ? '<span class="dot err"></span>' : k === 'gap' ? '<span class="dot"></span>' : '';
    const items = [['setup', g.allDone ? 'Plant' : 'Set up the plant', g.routingOk ? (g.allDone ? '' : 'gap') : 'err'], ['equipment', 'Equipment', (g.sensorsNoLimits.length + g.eqNeedingPM.length + g.probesNoCal.length + g.eqNoAlerts.length) ? 'gap' : ''], ['flows', 'Flows', g.causesNoFix.length ? 'gap' : ''], ['people', 'People & alerts', g.routingOk ? '' : 'err'], ['activity', 'Activity', '']];
    if (can('standards')) items.splice(3, 0, ['standards', 'Standard sets', '']);
    $('#nav').innerHTML = `<div class="eyebrow">${esc(D().plant.name)}</div>${items.map(([r, l, k]) => `<a class="item ${view === r ? 'active' : ''}" href="#/${r}">${l}${dot(k)}</a>`).join('')}
      <div class="foot">Signed in as <b>${esc(PERSONA[S.persona].who)}</b><br>${esc(PERSONA[S.persona].label)}<div style="margin-top:8px"><a href="index.html">← Read the proposal</a></div></div>`;
    $('#persona').value = S.persona; $('#crumb').innerHTML = `<b>${esc(D().plant.name)}</b>`;
  }
  function render() {
    document.body.classList.toggle('model', S.model); renderNav();
    const { view, rest } = route(); const V = window.CTL_VIEWS;
    const fn = V[view] || V.setup; const main = $('#main');
    if (!S.loadedRoutes.has(view)) { S.loadedRoutes.add(view); main.innerHTML = skeleton(); setTimeout(() => { main.innerHTML = fn(rest); V.wire(view, rest); }, 350); }
    else { main.innerHTML = fn(rest); V.wire(view, rest); }
    renderSheet(); renderGuide(); window.scrollTo({ top: 0 });
  }
  const skeleton = () => `<div class="skel"><div class="sk h"></div><div class="sk"></div><div class="sk"></div><div class="sk w"></div></div>`;
  function openSheet(sheet) { S.sheet = { step: 1, ...sheet }; renderSheet(); renderGuide(); }
  function closeSheet() { S.sheet = null; renderSheet(); renderGuide(); }
  function renderSheet() { $('#sheet')?.remove(); $('#scrim')?.remove(); if (!S.sheet) return; const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim'; scrim.onclick = closeSheet; const el = document.createElement('div'); el.className = 'sheet'; el.id = 'sheet'; document.body.appendChild(scrim); document.body.appendChild(el); window.CTL_SHEETS[S.sheet.kind](el); $('.x', el)?.addEventListener('click', closeSheet); document.onkeydown = (e) => { if (e.key === 'Escape') closeSheet(); }; }
  const sheetFrame = (el, title, sub, body, foot, rail) => { el.innerHTML = `<div class="sh"><div style="flex:1"><h2>${title}</h2><div class="sub">${sub}</div></div><button class="x" aria-label="Close">×</button></div>${rail ? `<div class="rail">${rail}</div>` : ''}<div class="sb">${body}</div><div class="sf">${foot}</div>`; };
  const stepRail = (steps, cur) => steps.map((s, i) => `<button class="rs ${i + 1 === cur ? 'cur' : ''} ${i + 1 < cur ? 'done' : ''}" data-step="${i + 1}"><span class="n">${i + 1 < cur ? '✓' : i + 1}</span>${esc(s)}</button>`).join('');
  const segWire = (el, id, cb) => $$(`#${id} button`, el).forEach((b) => b.onclick = () => { $$(`#${id} button`, el).forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); cb && cb(b.dataset.v); });
  const segVal = (el, id) => $(`#${id} button[aria-pressed=true]`, el)?.dataset.v;
  const failedBanner = (retryId, draftId) => `<div class="note err" style="margin-bottom:14px"><span><b>Nothing was saved.</b> The network did not answer. Your changes are still here. <button class="btn sm" id="${retryId}" style="margin-left:8px">Try again</button> ${draftId ? `<button class="btn sm ghost" id="${draftId}">Keep as a draft on this device</button>` : ''}</span></div>`;

  function boot() {
    $('#persona').onchange = (e) => { S.persona = e.target.value; S.sheet = null; if (S.persona !== 'global' && route().view === 'standards') location.hash = '#/setup'; render(); };
    $('#reset').onclick = () => { resetData(); render(); toast('Reset to the starting data.'); };
    $('#guideBtn').onclick = () => setGuide(!S.guide);
    render();
  }

  return { S, $, $$, esc, uid, plural, cap, SEVS, SEV_LABEL, SEV_CLOCK, TIER_LABEL, TIER_SHARE, ROLE_LABEL, GRANT_LABEL, WT_LABEL, PERSONA, can, D, eq, stage, group, sensor, flow, cause, alertById, schedById, workById, subjectName, subjectTier, subjectKey, parseNode, sensorHome, sensorsOf, limitsOfAlert, entrySeverity, deepestSeverity, limitsText, fmtLimits, every, closeDefault, taskClocks, fmtH, suggestedLimits, people, ops, leads, seniors, seniorOrLeads, siteAdmins, first, issueLadder, ladderSummary, taskLadder, toldBlock, gaps, nodeStatus, toast, audit, modal, save, openSheet, closeSheet, sheetFrame, stepRail, segWire, segVal, failedBanner, render, renderGuide, clone, boot, route };
})();
