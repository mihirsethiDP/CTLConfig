/* v7/8 · upalert78.js — alerts across a unit process.
   An equipment type stands for one piece of equipment with its own identity, so its alerts read only what sits on it.
   A unit process is a treatment step: a tank, the equipment that serves it and the pipes between them. Its alerts are written
   against kinds of reading, wherever in the step the sensor sits, on equipment or on a pipe. One alert may club several
   kinds of reading together, and it leads to one piece of work: an issue with its diagnostic, a task, or a calibration.

   In the library (Global Admin):  alerts(code) · saveAlert(code, alert) · removeAlert(code, id)
     alert = { id, name, match: 'all' | 'any', when: [{ reading, dir: 'above' | 'below', limit, of: 'any' | 'all' }], band, hold,
               starts: { kind: 'issue' | 'task' | 'calibration', flowId } }
   At a plant (when it inherits):  offers(key) → one line per unit process and alert:
     { pid, upId, upTag, upName, typeName, alert, conds: [{ reading, dir, limit, of, unit, kind, found: [sensor], use: [sensorId] }],
       missing: [reading], skipped, state: null | 'applied' | 'left', own, now: { fires, parts } }
     decide(key, pid, 'applied' | 'left' | null) · edit(key, pid, { name, match, when: [{ reading, dir, limit, of, use }], band, hold })
     scope(key, upId) → every sensor in the unit process, on equipment or on a pipe
   A kind of reading nothing in the unit process sends is named, and an alert that cannot work without it is skipped and flagged.
   This prototype works out whether an applied alert would fire on the latest readings; it does not open the issue or the task. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const C = () => W.CTL;
  const BANDS = ['caution', 'minor', 'major', 'emergency']; const BAND_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const arr = (x) => (Array.isArray(x) ? x : []); const clone = (x) => JSON.parse(JSON.stringify(x));
  const cat = (code) => (W.CATALOGUE_BY_CODE && W.CATALOGUE_BY_CODE[code]) || null;
  const RD = (n) => (W.READINGS || {})[n] || null;
  const flows = () => arr(C() && C().S && C().S.lib ? C().S.lib.flows : []);
  const flowById = (id) => (id ? flows().find((f) => f.id === id) || null : null);
  const isCal = (f) => f.kind !== 'diagnostic' && (f.use === 'calibration' || /calibrat/i.test(f.name || ''));
  const flowFits = (kind, f) => !!f && (kind === 'issue' ? f.kind === 'diagnostic' : kind === 'calibration' ? isCal(f) : f.kind !== 'diagnostic' && f.use !== 'fix');
  const w = (reading, dir, limit, of) => ({ reading, dir, limit, of: of || 'any' });
  const A = (id, name, match, when, band, hold, kind, flowId) => ({ id, name, match, when, band, hold, starts: { kind, flowId: flowId || null } });
  /* what the library ships with: a first draft, to confirm */
  const AERATED = [
    A('ua_lowdo_air', 'Low DO while a blower is drawing current', 'all', [w('Dissolved oxygen', 'below', 1.5), w('Motor current', 'above', 5)], 'major', 10, 'issue', 'f_lowdo'),
    A('ua_header', 'Air header pressure low with DO falling', 'all', [w('Line pressure', 'below', 0.3), w('Dissolved oxygen', 'below', 2)], 'major', 10, 'issue', 'f_lowdo'),
    A('ua_do_drift', 'DO reads high while MLSS is low', 'all', [w('Dissolved oxygen', 'above', 4), w('MLSS', 'below', 2000)], 'minor', 30, 'calibration', 'f_do_cal'),
    A('ua_ras', 'Return flow low with MLSS falling', 'all', [w('Flow', 'below', 10), w('MLSS', 'below', 2500)], 'minor', 30, 'issue', 'f_mlss'),
  ];
  const SHIPPED = {
    activated_sludge: AERATED, sbr: AERATED.slice(0, 3),
    mbbr: [A('ua_mbbr_air', 'Low DO with a blower running', 'all', [w('Dissolved oxygen', 'below', 2), w('Run status', 'above', null)], 'major', 10, 'issue', 'f_mbbr'),
      A('ua_mbbr_noair', 'No blower running', 'all', [w('Run status', 'below', null, 'all')], 'emergency', 5, 'issue', 'f_blower_trip')],
    equalization: [A('ua_eq_level', 'Level high while no pump draws current', 'all', [w('Level', 'above', 85), w('Motor current', 'below', 1, 'all')], 'major', 10, 'issue', 'f_eq_level'),
      A('ua_eq_ph', 'pH out of range in the tank', 'any', [w('pH', 'above', 9), w('pH', 'below', 6)], 'minor', 15, 'issue', 'f_ph')],
    ultrafiltration: [A('ua_uf_foul', 'Inlet pressure high with recovery falling', 'all', [w('Inlet pressure', 'above', 3), w('Recovery', 'below', 75)], 'minor', 20, 'task', 'f_backwash')],
    media_filtration: [A('ua_mf_choke', 'Filter choking', 'all', [w('Differential pressure', 'above', 0.8)], 'minor', 15, 'task', 'f_backwash')],
    mbr: [A('ua_mbr_foul', 'Permeability falling with turbidity rising', 'all', [w('Permeability', 'below', 80), w('Outlet turbidity', 'above', 5)], 'major', 20, 'issue', null)],
    clarification: [A('ua_blanket', 'Sludge blanket rising', 'all', [w('Sludge blanket', 'above', 1.2)], 'minor', 30, 'issue', 'f_blanket')],
    tube_settling: [A('ua_blanket', 'Sludge blanket rising', 'all', [w('Sludge blanket', 'above', 1.2)], 'minor', 30, 'issue', 'f_blanket')],
  };
  const isProcess = (code) => { const c = cat(code); return !!c && c.library === 'process'; };
  function libStore() { const L = V().S.lib; if (!L.upAlerts || typeof L.upAlerts !== 'object') L.upAlerts = {}; return L.upAlerts; }
  function alerts(code) { const st = libStore(); return clone(st[code] || arr(SHIPPED[code]).map((a) => ({ ...a, starts: { kind: a.starts.kind, flowId: flowById(a.starts.flowId) ? a.starts.flowId : null } }))); }
  const isNum = (r) => { const R = RD(r); return !!R && R.kind !== 'status' && R.kind !== 'meter'; };
  function clean(x, readingsOk) {
    const name = String((x && x.name) || '').trim(); if (!name) return { error: 'Give the alert a name.' };
    const when = arr(x.when).map((c) => ({ reading: c.reading, dir: c.dir === 'below' ? 'below' : 'above', limit: c.limit === '' || c.limit == null ? null : Number(c.limit), of: c.of === 'all' ? 'all' : 'any', ...(Array.isArray(c.use) ? { use: c.use.slice() } : {}) }));
    if (!when.length) return { error: 'Add at least one reading for it to watch.' };
    for (const c of when) {
      const R = RD(c.reading); if (!R) return { error: 'Choose a kind of reading on every line.' };
      if (readingsOk && !readingsOk(c.reading)) return { error: `Nothing in this unit process sends ${c.reading}.` };
      if (R.kind === 'meter') return { error: `${c.reading} only counts up: it takes no limit.` };
      if (R.kind === 'status') c.limit = null; else if (!Number.isFinite(c.limit)) return { error: `Give ${c.reading} a limit.` };
      else if (R.valid && (c.limit < R.valid[0] || c.limit > R.valid[1])) return { error: `${c.reading} reads between ${R.valid[0]} and ${R.valid[1]}${R.unit ? ' ' + R.unit : ''}. ${c.limit} is outside that.` };
    }
    const band = BANDS.includes(x.band) ? x.band : 'minor'; const hold = Math.max(0, Math.round(Number(x.hold) || 0));
    return { name, when, match: x.match === 'any' ? 'any' : 'all', band, hold };
  }
  function saveAlert(code, x) {
    const c = cat(code); if (!c || !isProcess(code)) return { ok: false, error: 'Alerts across readings belong to a unit process. An equipment type reads only what sits on it.' };
    const k = clean(x); if (k.error) return { ok: false, error: k.error };
    const kind = ['issue', 'task', 'calibration'].includes(x.starts && x.starts.kind) ? x.starts.kind : 'issue'; const f = x.starts && x.starts.flowId ? flowById(x.starts.flowId) : null;
    if (x.starts && x.starts.flowId && !flowFits(kind, f)) return { ok: false, error: kind === 'issue' ? 'An issue starts a diagnostic flow. Choose one of those.' : kind === 'calibration' ? 'Choose a calibration flow.' : 'A task follows a task flow. Choose one of those.' };
    if (kind !== 'issue' && !f) return { ok: false, error: kind === 'task' ? 'Choose the flow the task follows.' : 'Choose the calibration flow.' };
    if (kind !== 'issue' && k.band === 'emergency') return { ok: false, error: 'An Emergency always opens an issue.' };
    const list = alerts(code); const i = x.id ? list.findIndex((a) => a.id === x.id) : -1;
    if (list.some((a, j) => j !== i && a.name.toLowerCase() === k.name.toLowerCase())) return { ok: false, error: `${c.type} already has an alert called ${k.name}.` };
    const al = { id: i >= 0 ? list[i].id : 'ua_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: k.name, match: k.match, when: k.when.map((q) => ({ reading: q.reading, dir: q.dir, limit: q.limit, of: q.of })), band: k.band, hold: k.hold, starts: { kind, flowId: f ? f.id : null } };
    if (i >= 0) list[i] = al; else list.push(al); libStore()[code] = list;
    V().log(null, `${c.type}: ${i >= 0 ? 'changed' : 'added'} the alert "${al.name}" (${sentence(al, null)})`, 'library'); return { ok: true, alert: al };
  }
  function removeAlert(code, id) {
    const c = cat(code); const list = alerts(code); const i = list.findIndex((a) => a.id === id); if (!c || i < 0) return { ok: false, error: 'No such alert.' };
    const at = arr(V().plants()).find((p) => Object.keys(plantStore(p.key)).some((pid) => pid.split('|')[1] === id && plantStore(p.key)[pid].state === 'applied' && upOf(p.key, pid.split('|')[0]) && upOf(p.key, pid.split('|')[0]).typeId === code));
    if (at) return { ok: false, error: `${at.name} has applied it. Leave it out there first.` };
    const [al] = list.splice(i, 1); libStore()[code] = list; V().log(null, `${c.type}: removed the alert "${al.name}"`, 'library'); return { ok: true };
  }

  /* ── at a plant ─────────────────────────────────────────────────────────────────────────────────────── */
  function plantStore(key) { const P = V().S.plants[key]; if (!P) return {}; if (!P.upAlerts || typeof P.upAlerts !== 'object') P.upAlerts = {}; return P.upAlerts; }
  const ups = (key) => { try { return arr(V().structure(key).ups); } catch (e) { return []; } };
  const upOf = (key, upId) => ups(key).find((u) => u.id === upId) || null;
  function scope(key, upId) {
    const u = upOf(key, upId); if (!u) return []; const ids = [u.id].concat(arr(u.members).map((m) => m.eqId)); let ss = []; try { ss = arr(V().sensors(key)); } catch (e) { ss = []; }
    return ss.filter((s) => ids.includes(s.eqId)).map((s) => ({ id: s.id, name: s.name, tag: s.tag, eqTag: s.eqTag, unit: s.unit, kind: s.kind, onPipe: !!s.nextPhase || (RD(s.name) || {}).where === 'connection', where: s.nextPhaseNote || '', v: s.latest ? s.latest.v : null }));
  }
  const passes = (v, c) => (v == null ? false : (RD(c.reading) || {}).kind === 'status' ? (c.dir === 'below' ? +v === 0 : +v === 1) : c.dir === 'below' ? v < c.limit : v > c.limit);
  function offerOf(key, u, al, sc) {
    const pid = `${u.id}|${al.id}`; const rec = plantStore(key)[pid] || null; const own = rec && rec.own ? rec.own : null; const use = own || al;
    const conds = arr(use.when).map((c) => { const R = RD(c.reading) || {}; const found = sc.filter((s) => s.name === c.reading); const picked = Array.isArray(c.use) ? found.filter((s) => c.use.includes(s.id)) : found; return { reading: c.reading, dir: c.dir, limit: c.limit, of: c.of || 'any', unit: R.unit || '', kind: R.kind || '', found, use: (picked.length ? picked : found).map((s) => s.id) }; });
    const missing = [...new Set(conds.filter((c) => !c.found.length).map((c) => c.reading))]; const live = conds.filter((c) => c.found.length);
    const match = use.match === 'any' ? 'any' : 'all'; const skipped = match === 'all' ? missing.length > 0 : live.length === 0;
    const parts = conds.map((c) => { const vs = c.found.filter((s) => c.use.includes(s.id)); const hit = vs.filter((s) => passes(s.v, c)); return { reading: c.reading, ok: vs.length ? (c.of === 'all' ? hit.length === vs.length : hit.length > 0) : false, n: vs.length }; });
    const usable = parts.filter((p) => p.n); const fires = !skipped && usable.length > 0 && (match === 'all' ? usable.every((p) => p.ok) : usable.some((p) => p.ok));
    return { pid, upId: u.id, upTag: u.tag, upName: u.name, typeId: u.typeId, typeName: u.typeName, alert: al, name: use.name || al.name, match, band: use.band || al.band, hold: use.hold != null ? use.hold : al.hold, starts: al.starts, conds, missing, skipped, state: rec ? rec.state : null, own: !!own, onPipe: conds.some((c) => c.found.some((s) => s.onPipe && c.use.includes(s.id))), now: { fires, parts } };
  }
  function offers(key, o) {
    const out = []; ups(key).forEach((u) => { if (o && o.upId && o.upId !== u.id) return; const list = alerts(u.typeId); if (!list.length) return; const sc = scope(key, u.id); list.forEach((al) => out.push(offerOf(key, u, al, sc))); }); return out;
  }
  const offer = (key, pid) => offers(key, { upId: String(pid).split('|')[0] }).find((x) => x.pid === pid) || null;
  function decide(key, pid, state) {
    const of = offer(key, pid); if (!of) return { ok: false, error: 'No such alert here.' }; const st = plantStore(key);
    if (state === 'applied' && of.skipped) return { ok: false, error: `It cannot work here: nothing in ${of.upTag} sends ${of.missing.join(' or ')}.` };
    const rec = st[pid] || (st[pid] = {}); if (state == null) { if (rec.own) delete rec.state; else delete st[pid]; } else { rec.state = state; rec.at = V().now ? V().now() : Date.now(); }
    const live = (() => { try { return V().state(key) === 'live'; } catch (e) { return false; } })();
    V().log(key, state === 'applied' ? `Applied the unit-process alert "${of.name}" on ${of.upTag}: ${live ? 'On trial for 7 days' : 'it records trial firings while the plant is set up'}` : state === 'left' ? `Left out the unit-process alert "${of.name}" on ${of.upTag}` : `Set the unit-process alert "${of.name}" on ${of.upTag} back to undecided`, 'config');
    return { ok: true };
  }
  function edit(key, pid, x) {
    const of = offer(key, pid); if (!of) return { ok: false, error: 'No such alert here.' }; const sc = scope(key, of.upId); const st = plantStore(key);
    if (x == null) { const rec = st[pid]; if (rec) { delete rec.own; if (!rec.state) delete st[pid]; } V().log(key, `${of.upTag}: the alert "${of.alert.name}" follows the library again`, 'config'); return { ok: true }; }
    const k = clean({ ...x, name: x.name || of.name }, (r) => sc.some((s) => s.name === r)); if (k.error) return { ok: false, error: k.error };
    if (of.starts.kind !== 'issue' && k.band === 'emergency') return { ok: false, error: 'An Emergency always opens an issue.' };
    for (const c of k.when) { if (c.use) { c.use = c.use.filter((id) => sc.some((s) => s.id === id && s.name === c.reading)); if (!c.use.length) return { ok: false, error: `Tick at least one ${c.reading} sensor.` }; } }
    const rec = st[pid] || (st[pid] = {}); rec.own = { name: k.name, match: k.match, when: k.when, band: k.band, hold: k.hold };
    V().log(key, `${of.upTag}: changed the alert "${k.name}" for this plant (${sentence(rec.own, null)})`, 'config'); return { ok: true };
  }
  const fmtLim = (c) => { const R = RD(c.reading) || {}; return R.kind === 'status' ? (c.dir === 'below' ? 'is OFF' : 'is ON') : `is ${c.dir === 'below' ? 'below' : 'above'} ${c.limit}${R.unit ? ' ' + R.unit : ''}`; };
  function sentence(al, of) {
    return arr(of ? of.conds : al.when).map((c) => { const tags = of ? c.found.filter((s) => c.use.includes(s.id)).map((s) => s.tag) : []; return `${c.reading}${tags.length ? ` (${c.of === 'all' && tags.length > 1 ? 'every one of ' : ''}${tags.join(', ')})` : !of && c.of === 'all' ? ' on every sensor' : ''} ${fmtLim(c)}`; }).join((of ? of.match : al.match) === 'any' ? ' or ' : ' and ');
  }
  W.V7UPALERT = { alerts, saveAlert, removeAlert, offers, offer, decide, edit, scope, sentence, isProcess, flowFits, libBox: () => '', plantCard: () => '' };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip; const enc = encodeURIComponent;
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b || a + 's'}`;
  const KIND = { issue: 'Opens an issue', task: 'Raises a task', calibration: 'Raises a calibration' };
  const startsHtml = (st) => { const f = flowById(st.flowId); return `${esc(KIND[st.kind])}${f ? `: <a href="#/flows/${esc(enc(f.id))}">${esc(f.name)}</a>` : st.kind === 'issue' ? ' <span class="ua-0">with no diagnostic flow yet</span>' : ''}`; };
  const condHtml = (c, of) => { const tags = of ? c.found.filter((s) => c.use.includes(s.id)) : []; return `<span class="ua-c${of && !c.found.length ? ' is-miss' : ''}"><b>${esc(c.reading)}</b>${tags.length ? ` <span class="ua-tags">${tags.map((s) => `<span class="ua-tag${s.onPipe ? ' is-pipe' : ''}" title="${esc(s.onPipe ? `On a pipe${s.where ? ': ' + s.where : ''}, by ${s.eqTag}` : `On ${s.eqTag}`)}">${esc(s.tag)}</span>`).join('')}</span>${c.of === 'all' && tags.length > 1 ? ' <span class="ua-of">every one</span>' : ''}` : !of && c.of === 'all' ? ' <span class="ua-of">on every sensor</span>' : ''} ${esc(fmtLim(c))}</span>`; };
  const whenHtml = (conds, match, of) => conds.map((c) => condHtml(c, of)).join(`<span class="ua-j">${match === 'any' ? 'or' : 'and'}</span>`);

  /* the library: what a unit-process type watches across its readings */
  function libBox(lt) {
    if (!lt || !isProcess(lt.code)) return ''; const list = alerts(lt.code);
    const rows = list.map((a) => `<li class="ua-row"><div class="ua-main"><div class="ua-t"><b>${esc(a.name)}</b> ${U.sev(a.band)}${a.when.length > 1 ? ` ${chip(plural(a.when.length, 'reading') + ' together', { tone: 'info', title: 'Several kinds of reading fire one alert' })}` : ''}</div><div class="ua-w">When ${whenHtml(a.when, a.match, null)}, for ${esc(a.hold)} min</div><div class="ua-s">${startsHtml(a.starts)}</div></div><div class="ua-acts">${btn('Edit', { act: 'ua:lib-open', data: { code: lt.code, id: a.id }, small: true })}${btn('Remove', { act: 'ua:lib-remove', data: { code: lt.code, id: a.id }, small: true, kind: 'ghost' })}</div></li>`).join('');
    return `<section class="ov-box ua-box"><header><h3>Alerts across the unit process</h3><span class="ov-n">${list.length}</span><span class="ov-hb">${btn('Add an alert', { act: 'ua:lib-open', data: { code: lt.code }, small: true, kind: list.length ? 'secondary' : 'primary', title: 'On one kind of reading, or several together' })}</span></header><div class="ov-b"><p class="ov-sub ua-lead">Written against kinds of reading, wherever in the step the sensor sits: on the tank, on the equipment that serves it, or on a pipe. Each plant is offered the ones its sensors can serve.</p>${rows ? `<ul class="ua-rows">${rows}</ul>` : '<p class="ov-none">None yet. Add one on a kind of reading, or on several together.</p>'}</div></section>`;
  }
  W.V7UPALERT.libBox = libBox;

  /* the editor: one form for the library and for a plant */
  let ED = null;
  const flowOpts = (kind, cur) => `<option value="">${kind === 'issue' ? 'No diagnostic flow yet' : 'Choose…'}</option>` + flows().filter((f) => flowFits(kind, f) && f.name).sort((a, b) => a.name.localeCompare(b.name)).map((f) => `<option value="${esc(f.id)}"${cur === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('');
  function readEd() {
    if (!ED) return; const g = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
    const nm = g('ua-name'); if (nm != null) ED.name = nm; ED.match = g('ua-match') || ED.match; ED.band = g('ua-band') || ED.band; const h = g('ua-hold'); if (h != null) ED.hold = h;
    if (ED.lib) { ED.starts.kind = g('ua-kind') || ED.starts.kind; const f = g('ua-flow'); ED.starts.flowId = f || null; }
    ED.when.forEach((c, i) => { const r = g(`ua-r${i}`); if (r != null) c.reading = r; c.dir = g(`ua-d${i}`) || c.dir; const l = g(`ua-l${i}`); if (l != null) c.limit = l; c.of = g(`ua-o${i}`) || c.of;
      if (!ED.lib) { const boxes = [...document.querySelectorAll(`[data-ua-use="${i}"]`)]; if (boxes.length) c.use = boxes.filter((b) => b.checked).map((b) => b.value); } });
  }
  function drawEd() {
    const E = ED; const sc = E.lib ? null : scope(E.key, E.upId); const names = E.lib ? Object.keys(W.READINGS || {}).filter((n) => RD(n).kind !== 'meter') : [...new Set(sc.map((s) => s.name))].filter((n) => RD(n) && RD(n).kind !== 'meter');
    const grp = (lab, ns) => (ns.length ? `<optgroup label="${lab}">${ns.map((n) => `<option value="${esc(n)}">${esc(n)}${RD(n).unit ? ` (${esc(RD(n).unit)})` : ''}</option>`).join('')}</optgroup>` : '');
    const rOpts = (cur) => { const eqN = names.filter((n) => RD(n).where !== 'connection'); const pN = names.filter((n) => RD(n).where === 'connection'); return (grp('Usually on equipment', eqN) + grp('Usually on a pipe', pN)).replace(`value="${esc(cur)}"`, `value="${esc(cur)}" selected`); };
    const rows = E.when.map((c, i) => {
      const R = RD(c.reading) || {}; const status = R.kind === 'status'; const found = sc ? sc.filter((s) => s.name === c.reading) : [];
      const use = Array.isArray(c.use) ? c.use : found.map((s) => s.id);
      return `<div class="ua-er"><div class="ua-er1"><select id="ua-r${i}" data-act="ua:row-set" aria-label="Kind of reading">${rOpts(c.reading)}</select><select id="ua-d${i}" aria-label="Condition">${status ? `<option value="above"${c.dir !== 'below' ? ' selected' : ''}>is ON</option><option value="below"${c.dir === 'below' ? ' selected' : ''}>is OFF</option>` : `<option value="above"${c.dir !== 'below' ? ' selected' : ''}>rises above</option><option value="below"${c.dir === 'below' ? ' selected' : ''}>falls below</option>`}</select>${status ? '' : `<span class="ua-lim"><input type="number" step="any" id="ua-l${i}" value="${esc(c.limit == null ? '' : c.limit)}" aria-label="Limit"><span>${esc(R.unit || '')}</span></span>`}${E.when.length > 1 ? btn('Remove', { act: 'ua:row-del', data: { i }, small: true, kind: 'ghost' }) : ''}</div>`
        + (sc ? (found.length ? `<div class="ua-use">${found.map((s) => `<label title="${esc(s.onPipe ? 'On a pipe by ' + s.eqTag : 'On ' + s.eqTag)}"><input type="checkbox" data-ua-use="${i}" value="${esc(s.id)}"${use.includes(s.id) ? ' checked' : ''}> ${esc(s.tag)}${s.onPipe ? ' <span class="ua-pp">pipe</span>' : ''}</label>`).join('')}${found.length > 1 ? `<select id="ua-o${i}" aria-label="How many must pass"><option value="any"${c.of !== 'all' ? ' selected' : ''}>any one of them</option><option value="all"${c.of === 'all' ? ' selected' : ''}>every one of them</option></select>` : ''}</div>` : `<div class="ua-use is-miss">Nothing in ${esc(E.upTag)} sends ${esc(c.reading)}. Choose another reading or remove this line.</div>`)
          : `<div class="ua-use"><select id="ua-o${i}" aria-label="Where there are several sensors"><option value="any"${c.of !== 'all' ? ' selected' : ''}>When there are several sensors: any one of them</option><option value="all"${c.of === 'all' ? ' selected' : ''}>When there are several sensors: every one of them</option></select></div>`) + '</div>';
    }).join(`<div class="ua-ej">${E.when.length > 1 ? `<select id="ua-match" aria-label="How the readings combine"><option value="all"${E.match !== 'any' ? ' selected' : ''}>and</option><option value="any"${E.match === 'any' ? ' selected' : ''}>or</option></select>` : ''}</div>`);
    const body = U.field({ label: 'Name', hint: 'What people see when it fires.', html: `<input type="text" id="ua-name" value="${esc(E.name || '')}" placeholder="For example: Low DO while a blower is running">` })
      + `<div class="field"><span class="field-l">Fires when</span><div class="ua-ed">${rows}</div><div class="ua-add">${btn('Add another reading', { act: 'ua:row-add', small: true, kind: 'secondary', title: E.lib ? 'Club another kind of reading into the same alert' : `Any reading found in ${E.upTag}` })}</div></div>`
      + `<div class="la-2">${U.field({ label: 'Severity', html: `<select id="ua-band">${BANDS.map((b) => `<option value="${b}"${E.band === b ? ' selected' : ''}>${BAND_LABEL[b]}</option>`).join('')}</select>` })}${U.field({ label: 'Must hold for (minutes)', html: `<input type="number" min="0" step="1" id="ua-hold" value="${esc(E.hold)}">` })}</div>`
      + (E.lib ? `<div class="la-2">${U.field({ label: 'What it leads to', html: `<select id="ua-kind" data-act="ua:row-set">${Object.keys(KIND).map((k) => `<option value="${k}"${E.starts.kind === k ? ' selected' : ''}>${KIND[k]}</option>`).join('')}</select>` })}${U.field({ label: E.starts.kind === 'issue' ? 'Diagnostic flow' : E.starts.kind === 'task' ? 'Task flow' : 'Calibration flow', html: `<select id="ua-flow">${flowOpts(E.starts.kind, E.starts.flowId)}</select>` })}</div><p class="la-n">Each plant with this unit process is offered it when its sensors can serve it, and a person there applies it or leaves it out. A kind of reading the plant does not send is named, and the alert is skipped.</p>`
        : `<p class="la-n">${startsHtml(E.starts)}. This changes the alert at ${esc(E.upTag)} only; the library keeps its own.</p>`);
    U.modal({ title: E.lib ? (E.id ? `Edit an alert of ${E.typeName}` : `Add an alert to ${E.typeName}`) : `${E.upTag}: ${E.title}`, wide: true, body,
      foot: (!E.lib && E.own ? btn('Back to the library\'s', { act: 'ua:reset', data: { plant: E.key, pid: E.pid }, kind: 'ghost' }) : '') + btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(E.lib ? (E.id ? 'Save' : 'Add to the type') : 'Save for this plant', { act: 'ua:save', kind: 'primary' }) });
  }
  U.on('ua:lib-open', (el) => { const code = el.getAttribute('data-code'); const id = el.getAttribute('data-id'); const c = cat(code); if (!c) return false; const a = id ? alerts(code).find((x) => x.id === id) : null;
    ED = a ? { lib: true, code, typeName: c.type, ...clone(a) } : { lib: true, code, typeName: c.type, id: null, name: '', match: 'all', when: [w(arr(c.sensors).filter((s) => s.kind !== 'meter').map((s) => s.name)[0] || 'Level', 'above', '')], band: 'minor', hold: 10, starts: { kind: 'issue', flowId: null } }; drawEd(); return false; });
  U.on('ua:edit', (el) => { const key = el.getAttribute('data-plant'); const of = offer(key, el.getAttribute('data-pid')); if (!of) return false;
    ED = { lib: false, key, pid: of.pid, upId: of.upId, upTag: of.upTag, title: of.name, own: of.own, name: of.name, match: of.match, band: of.band, hold: of.hold, starts: of.starts, when: of.conds.map((c) => ({ reading: c.reading, dir: c.dir, limit: c.limit, of: c.of, use: c.use.slice() })) }; drawEd(); return false; });
  U.on('ua:row-add', () => { readEd(); if (!ED) return false; const sc = ED.lib ? null : scope(ED.key, ED.upId); const pool = (sc ? [...new Set(sc.map((s) => s.name))] : Object.keys(W.READINGS || {})).filter((n) => RD(n) && RD(n).kind !== 'meter'); const next = pool.find((n) => !ED.when.some((c) => c.reading === n)) || pool[0]; if (!next) { U.toast('There is no other reading to add.'); return false; } ED.when.push({ reading: next, dir: (RD(next).direction === 'below') ? 'below' : 'above', limit: '', of: 'any' }); drawEd(); return false; });
  U.on('ua:row-del', (el) => { readEd(); if (!ED) return false; ED.when.splice(+el.getAttribute('data-i'), 1); drawEd(); return false; });
  U.on('ua:row-set', (el) => { if (!ED) return false; const before = ED.when.map((c) => c.reading); const k0 = ED.starts.kind; readEd(); ED.when.forEach((c, i) => { if (c.reading !== before[i]) { delete c.use; c.limit = ''; } }); if (ED.lib && ED.starts.kind !== k0) ED.starts.flowId = null; drawEd(); const f = document.getElementById(el.id); if (f) f.focus(); return false; });
  U.on('ua:save', () => { readEd(); if (!ED) return false; const r = ED.lib ? saveAlert(ED.code, ED) : edit(ED.key, ED.pid, ED); if (!r.ok) { U.toast(r.error); return false; } const lib = ED.lib; ED = null; U.closeModal(true); U.toast(lib ? 'Saved. Plants with this unit process are offered it.' : 'Saved for this plant.'); return undefined; });
  U.on('ua:reset', (el) => { const r = edit(el.getAttribute('data-plant'), el.getAttribute('data-pid'), null); ED = null; U.closeModal(true); U.toast(r.ok ? 'It follows the library again.' : r.error); return undefined; });
  U.on('ua:lib-remove', (el) => { const r = removeAlert(el.getAttribute('data-code'), el.getAttribute('data-id')); U.toast(r.ok ? 'Removed from the type.' : r.error); return undefined; });
  U.on('ua:decide', (el) => { const st = el.getAttribute('data-state'); const r = decide(el.getAttribute('data-plant'), el.getAttribute('data-pid'), st === 'none' ? null : st); U.toast(r.ok ? (st === 'applied' ? 'Applied. It is On trial first.' : st === 'left' ? 'Left out.' : 'Undecided again.') : r.error); return undefined; });
  U.on('ua:apply-all', (el) => { const key = el.getAttribute('data-plant'); const todo = offers(key).filter((o) => !o.skipped && !o.state); todo.forEach((o) => decide(key, o.pid, 'applied')); U.toast(`${plural(todo.length, 'alert')} applied. Each is On trial first.`); return undefined; });

  /* the plant: what its unit processes are offered */
  function plantCard(key) {
    const all = offers(key); if (!all.length) return '';
    const open = all.filter((o) => !o.skipped && !o.state); const skipped = all.filter((o) => o.skipped); const applied = all.filter((o) => o.state === 'applied');
    const byUp = []; all.forEach((o) => { let g = byUp.find((x) => x.id === o.upId); if (!g) byUp.push(g = { id: o.upId, tag: o.upTag, name: o.upName, typeName: o.typeName, typeId: o.typeId, rows: [] }); g.rows.push(o); });
    const row = (o) => {
      const d = (state, label, kind, title) => btn(label, { act: 'ua:decide', data: { plant: key, pid: o.pid, state }, small: true, kind, title });
      const acts = o.skipped ? '' : o.state ? d('none', 'Undo', 'ghost', 'Back to undecided') : d('applied', 'Apply', 'primary', 'It goes On trial first: it records, and tells nobody yet') + d('left', 'Leave out', 'ghost');
      const st = o.skipped ? chip('Skipped', { tone: 'warn' }) : o.state === 'applied' ? chip('Applied · On trial', { tone: 'ok' }) : o.state === 'left' ? chip('Left out', { tone: 'muted' }) : chip('To decide', { tone: 'info' });
      const miss = o.missing.length ? `<div class="ua-miss">${o.skipped ? 'Skipped' : 'Watching less'}: nothing in ${esc(o.upTag)} sends ${esc(o.missing.join(' or '))}. ${o.skipped ? 'Add the sensor in the Visualization and read again, or edit the alert to use what is here.' : 'It works on the readings that are here.'}</div>` : '';
      const now = o.skipped ? '' : `<span class="ua-now${o.now.fires ? ' is-on' : ''}" title="Worked out on the latest readings">${o.now.fires ? 'Would fire now' : 'Quiet now'}</span>`;
      return `<li class="ua-row${o.skipped ? ' is-skip' : ''}"><div class="ua-main"><div class="ua-t"><b>${esc(o.name)}</b> ${U.sev(o.band)} ${st}${o.own ? ` ${chip('Changed here', { tone: 'warn', title: 'This plant edited the alert; the library keeps its own' })}` : ''}${o.onPipe ? ` ${chip('Reads a pipe', { tone: 'muted', title: 'At least one of its sensors sits on a pipe, not on equipment' })}` : ''}</div><div class="ua-w">When ${whenHtml(o.conds, o.match, o)}, for ${esc(o.hold)} min ${now}</div><div class="ua-s">${startsHtml(o.starts)}</div>${miss}</div><div class="ua-acts">${acts}${btn('Edit', { act: 'ua:edit', data: { plant: key, pid: o.pid }, small: true, title: 'Change its limits, choose its sensors, or add another reading from this unit process' })}</div></li>`;
    };
    const head = `${plural(open.length, 'alert')} to decide${applied.length ? `, ${applied.length} applied` : ''}${skipped.length ? `, ${skipped.length} skipped for a missing reading` : ''}`;
    return `<section class="card ua-card" id="ua-card"><header class="card-h"><div class="card-hl"><h2 class="card-t">Alerts across a unit process</h2><p class="card-s">From the unit-process library. Each one watches kinds of reading wherever they sit in the step, on equipment or on a pipe. ${esc(head)}.</p></div><div class="card-a">${open.length > 1 ? btn(`Apply all ${open.length}`, { act: 'ua:apply-all', data: { plant: key }, small: true, kind: 'secondary' }) : ''}</div></header>`
      + byUp.map((g) => `<div class="ua-up"><p class="ua-uph"><b>${esc(g.tag)}</b> ${esc(g.name)} <a class="ua-upt" href="#/library/${esc(enc(g.typeId))}">${esc(g.typeName)}</a></p><ul class="ua-rows">${g.rows.map(row).join('')}</ul></div>`).join('') + '</section>';
  }
  W.V7UPALERT.plantCard = plantCard;
  if (U.afterRender) U.afterRender((main, path) => { try { const m = /^#?\/?p\/([^/?]+)\/library/.exec(String(path || location.hash).replace(/^#\//, '')); if (!m || !main || main.querySelector('#ua-card')) return; const html = plantCard(decodeURIComponent(m[1])); if (!html) return; let first = main.querySelector('.card'); if (first && first.previousElementSibling && /p7-sec-h/.test(first.previousElementSibling.className || '')) first = first.previousElementSibling; if (first) first.insertAdjacentHTML('beforebegin', html); else main.insertAdjacentHTML('beforeend', html); } catch (e) { /* the page still shows without it */ } });
})();
