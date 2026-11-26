/* v7/7 and v7/8 · libadd78.js — adding to a library type: a reading, an alert on a reading, a task.
   Until now a type could only have its existing values changed. A Global Admin can now give a type what it does not have yet.
   What is added reaches no plant by itself: at each plant with equipment of the type it shows up as a proposal on Alerts & Tasks,
   and a person there accepts it or leaves it out. An alert needs its reading to come from that plant's Visualization.

   window.V7LIBADD:
     readingsFor(code)  → the readings the database knows that this type does not have yet
     addReading(code, name) · addAlert(code, {reading, dir, name, limits:{caution,minor,major,emergency}, hold, clear}) · addTask(code, {name, workType, every:{n, unit}})
     remove(code, kind, name)   only what was added here, and only while no plant has taken it
     isAdded(code, kind, name) · sync()
   Kept in the saved state (V7.S.lib.added) and put back on the library every time the prototype boots or the story is reset. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const C = () => W.CTL;
  const BANDS = ['caution', 'minor', 'major', 'emergency']; const BAND_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const arr = (x) => (Array.isArray(x) ? x : []);
  const cat = (code) => (W.CATALOGUE_BY_CODE && W.CATALOGUE_BY_CODE[code]) || null;
  const sets = () => arr(C() && C().S && C().S.lib && C().S.lib.standardSets);
  function setOf(type, make) { let t = sets().find((x) => x.type === type) || null; if (!t && make) { t = { id: 't_add_' + String(type).toLowerCase().replace(/\W+/g, '_'), type, usedAt: 0, alerts: [], schedules: [] }; sets().push(t); } return t; }
  function ops() { const L = V().S.lib; if (!Array.isArray(L.added)) L.added = []; return L.added; }
  function apply(o) {
    const c = cat(o.code); if (!c) return;
    if (o.kind === 'reading') { const R = (W.READINGS || {})[o.name]; if (R && !c.sensors.some((s) => s.name === o.name)) c.sensors.push({ name: o.name, tag: R.tag, unit: R.unit, kind: R.kind, valid: arr(R.valid).slice(), direction: R.direction || null, reading: R.valid ? (R.valid[0] + R.valid[1]) / 2 : 0, added: true }); return; }
    if (o.kind === 'issue') {
      const L = W.ISSUES || (W.ISSUES = []);
      if (o.existingId) { const it = L.find((i) => i.id === o.existingId); if (it && !arr(it.homeTypes).includes(c.type)) { it.homeTypes = arr(it.homeTypes).concat([c.type]); it._addedTypes = arr(it._addedTypes).concat([c.type]); } return; }
      if (!L.some((i) => i.id === o.id)) L.push({ id: o.id, name: o.name, sheet: '', from: '', rows: [], homeTypes: [c.type], detection: [{ kind: o.foundBy, text: o.foundBy === 'sensor' ? `Sensor: the alert ${o.alert || ''}` : o.foundBy === 'manual' ? 'A manual or lab test' : 'Seen on the round', ...(o.foundBy === 'sensor' && o.alert ? { alert: o.alert, alerts: [o.alert] } : {}) }], causes: [], flow: o.flowId || null, source: 'Added in the console', added: true });
      return;
    }
    const st = setOf(c.type, true);
    if (o.kind === 'alert' && !st.alerts.some((a) => a.name === o.name)) st.alerts.push({ name: o.name, sensorKind: o.reading, direction: o.dir, limits: { ...o.limits }, hold: o.hold, clear: o.clear, added: true });
    if (o.kind === 'task' && !st.schedules.some((x) => x.name === o.name)) st.schedules.push({ name: o.name, workType: o.workType, basis: 'calendar', every: { ...o.every }, added: true });
  }
  function sync() {
    Object.keys(W.CATALOGUE_BY_CODE || {}).forEach((k) => { const c = W.CATALOGUE_BY_CODE[k]; if (c && Array.isArray(c.sensors)) c.sensors = c.sensors.filter((s) => !s.added); });
    sets().forEach((t) => { t.alerts = arr(t.alerts).filter((a) => !a.added); t.schedules = arr(t.schedules).filter((x) => !x.added); });
    { const L = W.ISSUES || []; for (let i = L.length - 1; i >= 0; i--) { if (L[i].added) L.splice(i, 1); else if (L[i]._addedTypes) { L[i].homeTypes = arr(L[i].homeTypes).filter((t) => !L[i]._addedTypes.includes(t)); delete L[i]._addedTypes; } } }
    ops().forEach(apply); if (V().touch) V().touch();
  }
  function done(code, text) { const v = V(); v.touch(); v.log(null, text, 'library'); v.persist(); return { ok: true }; }
  const isAdded = (code, kind, name) => ops().some((o) => o.code === code && o.kind === kind && o.name === name);
  /* this phase: alerts read what sits on the equipment. A reading taken on a pipe or a line is not offered */
  const onEq = (n) => { const R = (W.READINGS || {})[n]; return !!R && (R.where == null || R.where === 'equipment'); };
  function readingsFor(code) { const c = cat(code); if (!c) return []; const pipe = new Set(arr(c.nextPhase && c.nextPhase.readings).map((x) => x.name)); return Object.keys(W.READINGS || {}).filter((n) => !c.sensors.some((s) => s.name === n) && !pipe.has(n) && onEq(n)).map((n) => ({ name: n, unit: W.READINGS[n].unit, kind: W.READINGS[n].kind })).sort((a, b) => a.name.localeCompare(b.name)); }
  function addReading(code, name) {
    const c = cat(code); if (!c) return { ok: false, error: 'No such type.' }; if (!(W.READINGS || {})[name]) return { ok: false, error: 'Choose a reading.' };
    if (c.sensors.some((s) => s.name === name)) return { ok: false, error: `${c.type} already has ${name}.` };
    if (!onEq(name) || arr(c.nextPhase && c.nextPhase.readings).some((x) => x.name === name)) return { ok: false, error: `${name} is read on a pipe at this type: the unit process watches it, not the equipment.` };
    const o = { kind: 'reading', code, name }; ops().push(o); apply(o); return done(code, `Added to ${c.type}: the reading ${name}. It has no alert yet`);
  }
  function addAlert(code, a) {
    const c = cat(code); if (!c) return { ok: false, error: 'No such type.' }; const x = a || {}; const s = c.sensors.find((y) => y.name === x.reading);
    if (!s) return { ok: false, error: 'Choose a reading this type has.' }; if (s.kind === 'meter') return { ok: false, error: `${s.name} only counts up: it takes no limits.` };
    const dir = x.dir === 'below' ? 'below' : 'above'; const st = setOf(c.type, true); const name = String(x.name || '').trim();
    if (!name) return { ok: false, error: 'Give the alert a name.' };
    if (st.alerts.some((y) => y.name === name)) return { ok: false, error: `${c.type} already has an alert called ${name}.` };
    if (st.alerts.some((y) => y.sensorKind === s.name && y.direction === dir)) return { ok: false, error: `${s.name} already has limits for when it ${dir === 'below' ? 'falls' : 'rises'}. For a second alert on the same reading, with its own issue, use "${c.library === 'process' ? 'Alerts across the unit process' : 'More alerts on these readings'}" on this page.` };
    const limits = {}; let last = null;
    for (const b of BANDS) {
      const raw = x.limits ? x.limits[b] : null; if (raw == null || raw === '') continue; const v = Number(raw);
      if (!Number.isFinite(v)) return { ok: false, error: `${BAND_LABEL[b]} must be a number.` };
      if (s.kind !== 'status' && s.valid && (v < s.valid[0] || v > s.valid[1])) return { ok: false, error: `${BAND_LABEL[b]} ${v} is outside what ${s.name} can read (${s.valid[0]} to ${s.valid[1]}).` };
      if (last != null && (dir === 'above' ? v <= last : v >= last)) return { ok: false, error: `Each limit must be ${dir === 'above' ? 'higher' : 'lower'} than the one before it: Caution, Minor, Major, Emergency.` };
      limits[b] = v; last = v;
    }
    if (!Object.keys(limits).length) return { ok: false, error: 'Give at least one limit.' };
    const hold = Math.max(0, Math.round(+x.hold || 0)); const clear = Math.max(0, Math.round(x.clear == null || x.clear === '' ? 10 : +x.clear));
    const o = { kind: 'alert', code, name, reading: s.name, dir, limits, hold, clear }; ops().push(o); apply(o);
    return done(code, `Added to ${c.type}: the alert ${name}, when ${s.name} ${dir === 'below' ? 'falls below' : 'rises above'} ${BANDS.filter((b) => limits[b] != null).map((b) => `${BAND_LABEL[b]} ${limits[b]}`).join(', ')}${s.unit ? ' ' + s.unit : ''}. Plants with this type see it as a proposal`);
  }
  function addTask(code, t) {
    const c = cat(code); if (!c) return { ok: false, error: 'No such type.' }; const x = t || {}; const name = String(x.name || '').trim(); const st = setOf(c.type, true);
    if (!name) return { ok: false, error: 'Give the task a name.' }; if (st.schedules.some((y) => y.name === name)) return { ok: false, error: `${c.type} already has a task called ${name}.` };
    const WT = (C() && C().WT_LABEL) || {}; if (!WT[x.workType] || x.workType === 'condition') return { ok: false, error: 'Choose the kind of work.' };
    const n = Math.round(+((x.every || {}).n)); const unit = (x.every || {}).unit; const UH = (C() && C().UNIT_HOURS) || {};
    if (!(n >= 1) || !UH[unit]) return { ok: false, error: 'Say how often: a number and a unit.' }; if (n * UH[unit] < 24) return { ok: false, error: 'No task comes round more often than once a day.' };
    const o = { kind: 'task', code, name, workType: x.workType, every: { n, unit } }; ops().push(o); apply(o);
    return done(code, `Added to ${c.type}: the task ${name}, every ${n === 1 ? '' : n + ' '}${unit}${n === 1 ? '' : 's'} (${WT[x.workType]}). Plants with this type see it as a proposal`);
  }
  /* problems the library already knows that this type does not have, and adding one (known, or new) */
  function issuesFor(code) { const c = cat(code); if (!c) return []; return arr(W.ISSUES).filter((i) => !arr(i.homeTypes).includes(c.type)).map((i) => ({ id: i.id, name: i.name, on: arr(i.homeTypes).slice(0, 3).join(', ') })).sort((a, b) => a.name.localeCompare(b.name)); }
  function addIssue(code, x) {
    const c = cat(code); if (!c) return { ok: false, error: 'No such type.' }; const o = x || {};
    if (o.existingId) {
      const it = arr(W.ISSUES).find((i) => i.id === o.existingId); if (!it) return { ok: false, error: 'Choose a problem.' }; if (arr(it.homeTypes).includes(c.type)) return { ok: false, error: `${c.type} already has it.` };
      const op = { kind: 'issue', code, name: it.name, existingId: it.id }; ops().push(op); apply(op); return done(code, `Added to ${c.type}: the problem "${it.name}", as the library already knows it`);
    }
    const name = String(o.name || '').trim(); if (!name) return { ok: false, error: 'Name the problem.' };
    if (arr(W.ISSUES).some((i) => i.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'The library already knows a problem by that name. Choose it from the list instead.' };
    const foundBy = ['sensor', 'visual', 'manual'].includes(o.foundBy) ? o.foundBy : 'visual'; const st = setOf(c.type);
    if (foundBy === 'sensor' && !(st && st.alerts.some((a) => a.name === o.alert))) return { ok: false, error: 'Choose the alert that finds it. If the type has none, add an alert first.' };
    const op = { kind: 'issue', code, name, id: 'i_add_' + name.toLowerCase().replace(/\W+/g, '_').slice(0, 40), foundBy, alert: foundBy === 'sensor' ? o.alert : null, flowId: o.flowId || null }; ops().push(op); apply(op);
    return done(code, `Added to ${c.type}: the problem "${name}", found by ${foundBy === 'sensor' ? `the alert ${o.alert}` : foundBy === 'manual' ? 'a manual or lab test' : 'a look on the round'}${o.flowId ? '' : '. It has no diagnostic yet'}`);
  }
  function takenAt(code, kind, name) {
    const c = cat(code); const v = V(); if (!c) return null;
    for (const p of arr(v.plants())) {
      if (kind === 'alert' && arr(v.alerts(p.key)).some((a) => a.state !== 'draft' && a.state !== 'off' && String(a.name).indexOf(name) === 0 && (v.eq(p.key, a.eqId) || {}).typeName === c.type)) return p.name;
      if (kind === 'task' && arr(v.schedules(p.key)).some((s) => s.name === name && s.status === 'active' && (v.eq(p.key, s.eqId) || {}).typeName === c.type)) return p.name;
    }
    return null;
  }
  function remove(code, kind, name) {
    const c = cat(code); const L = ops(); const i = L.findIndex((o) => o.code === code && o.kind === kind && o.name === name);
    if (!c || i < 0) return { ok: false, error: 'Only what was added here can be removed.' };
    if (kind === 'reading' && (setOf(c.type) || { alerts: [] }).alerts.some((a) => a.sensorKind === name)) return { ok: false, error: `Remove the alert on ${name} first.` };
    const at = kind === 'reading' ? null : takenAt(code, kind, name); if (at) return { ok: false, error: `${at} has taken it. Leave it out there first.` };
    L.splice(i, 1); sync(); return done(code, `Removed from ${c.type}: the ${kind} ${name}`);
  }
  W.V7LIBADD = { readingsFor, issuesFor, addReading, addAlert, addTask, addIssue, remove, isAdded, sync };
  /* put the additions back whenever the state is loaded or reset */
  (function hook() { const v = V(); if (!v) return; ['boot', 'reset'].forEach((fn) => { const f0 = v[fn]; if (typeof f0 !== 'function') return; v[fn] = function () { const r = f0.apply(this, arguments); try { sync(); } catch (e) { /* the library stays as shipped */ } return r; }; }); })();

  /* ── the forms ─────────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn;
  const foot = (kind, code) => btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Add to the type', { act: 'la:save', data: { kind, code }, kind: 'primary' });
  const lands = '<p class="la-n">It reaches no plant by itself. Each plant with this type sees it as a proposal on Alerts &amp; Tasks, and a person there accepts it or leaves it out.</p>';
  function openForm(kind, code, pre) {
    const c = cat(code); if (!c) return;
    if (kind === 'reading') {
      const rs = readingsFor(code); if (!rs.length) { U.toast(`${c.type} already has every reading the database knows.`); return; }
      const KW = { process: 'measured', analytical: 'measured', status: 'on or off', meter: 'counts up', manual: 'entered by hand' };
      U.modal({ title: `Add a reading to ${c.type}`, body: U.field({ label: 'Reading', hint: 'Readings taken on the equipment itself. A reading on a pipe is watched by the unit process, not by the equipment. The unit and range come with it.', html: `<select id="la-reading"><option value="">Choose…</option>${rs.map((r) => `<option value="${esc(r.name)}">${esc(r.name)}${r.unit ? ` (${esc(r.unit)})` : ''} · ${esc(KW[r.kind] || r.kind)}</option>`).join('')}</select>` }) + '<p class="la-n">A reading on its own does nothing. Add an alert on it next, or use it for a task that runs on its hours.</p>', foot: foot('reading', code) });
      return;
    }
    if (kind === 'alert') {
      const rs = c.sensors.filter((s) => s.kind !== 'meter'); if (!rs.length) { U.toast('Add a reading first: an alert watches a reading.'); return; }
      const first = (pre && rs.find((s) => s.name === pre)) || rs[0];
      U.modal({ title: `Add an alert to ${c.type}`, body: `<div class="la-2">${U.field({ label: 'Reading it watches', html: `<select id="la-areading">${rs.map((s) => `<option value="${esc(s.name)}"${s === first ? ' selected' : ''}>${esc(s.name)}${s.unit ? ` (${esc(s.unit)})` : ''}</option>`).join('')}</select>` })}${U.field({ label: 'Bad when it', html: '<select id="la-dir"><option value="above">Rises above a limit</option><option value="below">Falls below a limit</option></select>' })}</div>`
        + U.field({ label: 'Name', hint: 'What people see on the issue.', html: `<input type="text" id="la-aname" placeholder="For example: ${esc(first.name)} high">` })
        + `<div class="la-4">${BANDS.map((b) => `<label class="la-b">${U.sev(b)}<input type="number" step="any" id="la-${b}" aria-label="${BAND_LABEL[b]} limit"></label>`).join('')}</div><p class="field-h">Fill the limits you want; leave the rest empty. In order: Caution, Minor, Major, Emergency.</p>`
        + `<div class="la-2">${U.field({ label: 'Must hold for (minutes)', html: '<input type="number" min="0" step="1" id="la-hold" value="5">' })}${U.field({ label: 'Must clear for (minutes)', html: '<input type="number" min="0" step="1" id="la-clear" value="10">' })}</div>` + lands, foot: foot('alert', code) });
      return;
    }
    if (kind === 'issue') {
      const known = issuesFor(code); const st = setOf(c.type); const als = st ? arr(st.alerts) : [];
      const flows = arr(C() && C().S && C().S.lib ? C().S.lib.flows : []).filter((f) => f.kind === 'diagnostic'); const near = flows.filter((f) => arr(f.forTypes).includes(c.type)); const rest = flows.filter((f) => !near.includes(f));
      const fo = (f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`;
      U.modal({ title: `Add a problem to ${c.type}`, body: U.field({ label: 'Which problem', hint: 'One the library already knows comes with how it is found, its diagnostic and its root causes.', html: `<select id="la-iknown"><option value="">A new problem…</option>${known.map((i) => `<option value="${esc(i.id)}">${esc(i.name)}${i.on ? ` (on ${esc(i.on)})` : ''}</option>`).join('')}</select>` })
        + `<div id="la-inew">${U.field({ label: 'Name', hint: 'What a person would call it.', html: '<input type="text" id="la-iname" placeholder="For example: Foaming on the basin">' })}`
        + `<div class="la-2">${U.field({ label: 'How it is found', html: `<select id="la-ifound"><option value="visual">A person sees it on the round</option><option value="manual">A manual or lab test</option>${als.length ? '<option value="sensor">An alert on this type</option>' : ''}</select>` })}${als.length ? U.field({ label: 'Which alert', hint: 'Only when an alert finds it.', html: `<select id="la-ialert"><option value="">None</option>${als.map((a) => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('')}</select>` }) : ''}</div>`
        + U.field({ label: 'Diagnostic it starts', hint: 'Optional. Without one, the person says what they found.', html: `<select id="la-iflow"><option value="">None yet</option>${near.length ? `<optgroup label="For ${esc(c.type)}">${near.map(fo).join('')}</optgroup>` : ''}<optgroup label="Other diagnostics">${rest.map(fo).join('')}</optgroup></select>` }) + '</div>'
        + '<p class="la-n">A problem a person can report on this type of equipment at every plant. It changes no alert and no task.</p>', foot: foot('issue', code) });
      const sel = document.getElementById('la-iknown'); const box = document.getElementById('la-inew'); if (sel && box) sel.addEventListener('change', () => { box.hidden = !!sel.value; });
      return;
    }
    const WT = (C() && C().WT_LABEL) || {}; const LF = W.V7LIBFLOW; const fo = LF && LF.options ? LF.options('task', code) : { near: [], rest: [] }; const have = new Set(arr((setOf(c.type) || {}).schedules).map((x) => x.name)); const fopt = (f) => `<option value="${esc(f.id)}"${have.has(f.name) ? ' disabled' : ''}>${esc(f.name)}${have.has(f.name) ? ' (already a task here)' : ''}</option>`;
    /* 27 Nov: a task is named after the flow it follows, and a task may come on a condition instead of a date */
    U.modal({ title: `Add a task to ${c.type}`, body: U.field({ label: 'Flow it follows', hint: 'The steps a person works through. The task takes its name from the flow.', html: `<select id="la-tflow"><option value="">No flow yet: I will name the task</option>${fo.near.length ? `<optgroup label="For ${esc(c.type)}">${fo.near.map(fopt).join('')}</optgroup>` : ''}${fo.rest.length ? `<optgroup label="Other task flows">${fo.rest.map(fopt).join('')}</optgroup>` : ''}</select>` })
      + U.field({ label: 'Name', html: '<input type="text" id="la-tname" placeholder="For example: Check the belt guard">' })
      + `<div class="la-2">${U.field({ label: 'Kind of work', hint: 'Condition-based: it comes when a condition holds, not on a date.', html: `<select id="la-wt" data-act="la:wt" data-code="${esc(code)}">${Object.keys(WT).filter((k) => k !== 'condition').map((k) => `<option value="${esc(k)}"${k === 'pm' ? ' selected' : ''}>${esc(WT[k])}</option>`).join('')}<option value="condition">Condition-based task</option></select>` })}${U.field({ label: 'Every', hint: 'Nothing comes round more often than once a day.', html: '<span class="la-ev"><input type="number" min="1" step="1" id="la-n" value="1"><select id="la-unit"><option value="day">days</option><option value="week">weeks</option><option value="month" selected>months</option><option value="year">years</option></select></span>' })}</div>` + lands, foot: foot('task', code) });
  }
  const val = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
  U.on('la:open', (el) => { openForm(el.getAttribute('data-kind'), el.getAttribute('data-code'), el.getAttribute('data-reading')); return false; });
  U.on('la:save', (el) => {
    const kind = el.getAttribute('data-kind'); const code = el.getAttribute('data-code'); let r;
    if (kind === 'reading') r = addReading(code, val('la-reading'));
    else if (kind === 'alert') { const lim = {}; BANDS.forEach((b) => { lim[b] = val('la-' + b); }); const rd = val('la-areading'); const dir = val('la-dir'); r = addAlert(code, { reading: rd, dir, name: val('la-aname') || `${rd} ${dir === 'below' ? 'low' : 'high'}`, limits: lim, hold: val('la-hold'), clear: val('la-clear') }); }
    else if (kind === 'issue') r = val('la-iknown') ? addIssue(code, { existingId: val('la-iknown') }) : addIssue(code, { name: val('la-iname'), foundBy: val('la-ifound'), alert: val('la-ialert'), flowId: val('la-iflow') });
    else { const fid = val('la-tflow'); const nm = String(val('la-tname') || '').trim(); r = addTask(code, { name: nm, workType: val('la-wt'), every: { n: val('la-n'), unit: val('la-unit') } }); if (r.ok && fid && W.V7LIBFLOW && W.V7LIBFLOW.set) { try { W.V7LIBFLOW.set('task', code, nm, fid); } catch (e) { /* it keeps no flow */ } } }
    if (!r.ok) { U.toast(r.error); return false; }
    U.closeModal(true); U.toast(kind === 'reading' ? 'Reading added. Add an alert on it to make it do something.' : kind === 'issue' ? 'Problem added. People can now report it on this type of equipment.' : `Added. Plants with this type now see it as a proposal.`); return undefined;
  });
  /* a condition-based task is written as its condition: the same form as an alert, leading to a task */
  U.on('la:wt', (el) => { if (el.value !== 'condition') return false; const code = el.getAttribute('data-code'); U.closeModal(true); const b = document.createElement('button'); b.type = 'button'; b.hidden = true; b.setAttribute('data-act', 'ua:lib-open'); b.setAttribute('data-code', code); b.setAttribute('data-starts', 'task'); document.body.appendChild(b); b.click(); b.remove(); return false; });
  U.on('la:remove', (el) => { const r = remove(el.getAttribute('data-code'), el.getAttribute('data-kind'), el.getAttribute('data-name')); U.toast(r.ok ? 'Removed from the type.' : r.error); return undefined; });
})();
