/* v7/7 and v7/8 · cal78.js — calibration on a reading: which flow, and how often.
   The library says it once per reading of a type ("Blower · Discharge pressure: every 6 months, Probe calibration against reference").
   Every sensor of that reading at a plant follows it, and a plant may keep its own for one sensor.
   A probe (an analytical reading) is calibrated every month unless the library says otherwise, as before.
   - Where a calibration task already exists at a plant it takes the interval and the flow.
   - Where the library adds calibration to a reading that had none, plants are offered "<Reading> calibration" under Alerts & Tasks.
   Applies at once, like the timelines; it does not go through the type's draft.

   window.V7CAL:
     lib(code, reading) → null | { n, unit, flowId, flowName, steps, set }       setLib(code, reading, { n, unit, flowId } | null)
     plant(key, sensorId) → null | { n, unit, flowId, flowName, steps, own, off, lib, task }      setPlant(key, sensorId, vals | 'off' | null)
     everyFor(key, sensorId) · wants(equipment, sensor) · flows(typeName) · sync() */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const C = () => W.CTL;
  const UNITS = ['day', 'week', 'month', 'year']; const KINDS = ['analytical', 'process', 'meter'];
  const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, d) => { try { const r = fn(); return r == null ? d : r; } catch (e) { return d; } };
  const allFlows = () => arr(safe(() => C().S.lib.flows, []));
  const flowOf = (id) => (id ? allFlows().find((f) => f.id === id) || null : null);
  const flows = (typeName) => { const fs = allFlows().filter((f) => f.use === 'calibration'); return { near: fs.filter((f) => arr(f.forTypes).includes(typeName)), any: fs.filter((f) => !arr(f.forTypes).includes(typeName)) }; };
  const everyText = (x) => safe(() => V().everyText({ n: x.n, unit: x.unit }), `every ${x.n} ${x.unit}`);
  function libStore() { const L = V().S.lib; if (!L.cal || typeof L.cal !== 'object') L.cal = {}; return L.cal; }
  const plantRec = (key) => safe(() => V().S.plants[key], null);
  function plantStore(key) { const P = plantRec(key); if (!P) return {}; if (!P.cal || typeof P.cal !== 'object') P.cal = {}; return P.cal; }
  const defFor = (reading, kind) => (kind === 'analytical' ? { n: 1, unit: 'month', flowId: (W.CAL_FLOWS || {})[reading] || W.CAL_FLOW_DEFAULT || null } : null);
  const deco = (x) => { if (!x) return null; const f = flowOf(x.flowId); return { n: x.n, unit: x.unit, flowId: f ? f.id : null, flowName: f ? f.name : null, steps: f ? arr(f.steps).length : 0 }; };
  const kindOf = (code, reading) => { const lt = safe(() => V().libType(code), null); const r = lt ? arr(lt.readings).find((x) => x.name === reading) : null; return r ? r.kind : null; };
  function libRaw(code, reading, kind) { const o = (libStore()[code] || {})[reading]; if (o) return o.off ? null : o; return defFor(reading, kind); }
  function lib(code, reading) { const kind = kindOf(code, reading); if (!kind) return null; const x = deco(libRaw(code, reading, kind)); if (x) x.set = !!(libStore()[code] || {})[reading]; return x; }
  function clean(x, typeName) {
    const n = Number(x && x.n); if (!Number.isInteger(n) || n < 1 || n > 60) return { error: 'How often: give a whole number from 1 to 60.' };
    if (!UNITS.includes(x.unit)) return { error: 'How often: pick days, weeks, months or years.' };
    const fid = x.flowId || null; if (fid) { const f = flowOf(fid); if (!f || f.use !== 'calibration') return { error: 'Pick one of the calibration flows.' }; }
    return { n, unit: x.unit, flowId: fid };
  }
  const sameCal = (a, b) => !!a && !!b && +a.n === +b.n && a.unit === b.unit && (a.flowId || null) === (b.flowId || null);
  const words = (x) => (x ? `${everyText(x)}${x.flowId && flowOf(x.flowId) ? `, by the flow "${flowOf(x.flowId).name}"` : ', no flow yet'}` : 'no calibration');
  /* each plant sensor with its equipment and type code */
  function sensorsAt(key) { const eqs = {}; arr(safe(() => V().equipment(key), [])).forEach((e) => { eqs[e.id] = e; }); return arr(safe(() => V().sensors(key), [])).filter((s) => !s.nextPhase && s.eqId && eqs[s.eqId]).map((s) => ({ s, e: eqs[s.eqId], code: eqs[s.eqId].code || eqs[s.eqId].dbType })); }
  const schedules = (key) => arr(safe(() => C().S.plants[key].d.schedules, []));
  const taskOf = (key, sensorId) => schedules(key).find((x) => x.workType === 'calibration' && x.probe === sensorId) || null;
  function plant(key, sensorId) {
    const r = sensorsAt(key).find((x) => x.s.id === sensorId); if (!r || !KINDS.includes(r.s.kind)) return null;
    const base = deco(libRaw(r.code, r.s.name, r.s.kind)); const o = plantStore(key)[sensorId]; const t = taskOf(key, sensorId);
    const cur = o ? (o.off ? null : deco(o)) : base;
    return { ...(cur || { n: null, unit: null, flowId: null, flowName: null, steps: 0 }), off: !cur, own: !!o, lib: base, task: t ? { id: t.id, name: t.name, status: t.status } : null, eqId: r.e.id, code: r.code, reading: r.s.name, typeName: r.e.typeName, tag: r.s.tag, eqTag: r.e.tag };
  }
  const everyFor = (key, sensorId) => { const p = safe(() => plant(key, sensorId), null); return p && !p.off && p.n ? { n: p.n, unit: p.unit } : null; };
  /* asked by the engine when it lists what a piece of equipment can take: does this sensor get a calibration task? */
  function wants(e, s) {
    try { if (!e || !s || !KINDS.includes(s.kind)) return false; const key = C().S.plant; const o = key ? plantStore(key)[s.id] : null; if (o) return !o.off; return !!libRaw(e.dbType || e.code, s.name, s.kind); } catch (err) { return !!s && s.kind === 'analytical'; }
  }
  /* bring the calibration tasks that exist in line. Only where the library or the plant has said something, or where told to. */
  function sync(force) {
    let any = false;
    arr(safe(() => V().plants(), [])).forEach((p) => { const key = p.key; const rs = sensorsAt(key); const ovs = arr(safe(() => V().S.overrides, [])).filter((o) => o.plant === key && !o.endedAt && o.target && o.target.kind === 'cadence');
      schedules(key).filter((x) => x.workType === 'calibration' && x.probe).forEach((sc) => {
        const r = rs.find((x) => x.s.id === sc.probe); if (!r) return; const said = !!plantStore(key)[sc.probe] || !!(libStore()[r.code] || {})[r.s.name];
        if (!said && !(force && force(key, r))) return; const cur = plant(key, sc.probe); if (!cur || cur.off || !cur.n) return;
        if (!ovs.some((o) => o.target.scheduleId === sc.id || o.target.id === sc.id || o.target.schedule === sc.name) && (!sc.every || +sc.every.n !== +cur.n || sc.every.unit !== cur.unit)) { sc.every = { n: cur.n, unit: cur.unit }; any = true; }
        if ((sc.flow || null) !== (cur.flowId || null)) { sc.flow = cur.flowId || null; any = true; }
      }); });
    if (any && V().touch) V().touch(); return any;
  }
  function setLib(code, reading, x) {
    const lt = safe(() => V().libType(code), null); const kind = kindOf(code, reading); if (!lt || !kind) return { ok: false, error: 'No such reading on this type.' };
    if (!KINDS.includes(kind)) return { ok: false, error: 'This kind of reading is not calibrated.' };
    const S = libStore(); const def = defFor(reading, kind); let k = null;
    if (x != null) { k = clean(x, lt.typeName); if (k.error) return { ok: false, error: k.error }; }
    S[code] = S[code] || {}; if (k == null) { if (def) S[code][reading] = { off: true }; else delete S[code][reading]; } else if (def && sameCal(k, def)) delete S[code][reading]; else S[code][reading] = k;
    if (!Object.keys(S[code]).length) delete S[code];
    sync((key, r) => r.code === code && r.s.name === reading);
    V().log(null, `Calibration of ${reading} on ${lt.typeName}: ${words(k)}. Every sensor that follows the library has it now`, 'library'); if (V().persist) V().persist(); return { ok: true };
  }
  const CAL = (sensorId) => ({ kind: 'cal', sensor: sensorId });
  function check(code, reading, x) { const lt = safe(() => V().libType(code), null); const kind = kindOf(code, reading); if (!lt || !kind) return 'No such reading on this type.'; if (!KINDS.includes(kind)) return 'This kind of reading is not calibrated.'; if (x != null) { const k = clean(x, lt.typeName); if (k.error) return k.error; } return null; }
  function setPlant(key, sensorId, x, why) {
    const cur = plant(key, sensorId); if (!cur) return { ok: false, error: 'This reading is not calibrated.' }; const st = plantStore(key);
    if (x == null) { delete st[sensorId]; } else if (x === 'off') { if (cur.lib) st[sensorId] = { off: true }; else delete st[sensorId]; }
    else { const k = clean(x, cur.typeName); if (k.error) return { ok: false, error: k.error }; if (cur.lib && sameCal(k, cur.lib)) delete st[sensorId]; else st[sensorId] = k; }
    sync((k2, r) => k2 === key && r.s.id === sensorId); const now = plant(key, sensorId);
    if (W.V7OVX) { if (now.own) W.V7OVX.record(key, CAL(sensorId), words(now.off ? null : now), words(now.lib), why); else W.V7OVX.end(key, CAL(sensorId)); }
    V().log(key, `Calibration of ${cur.reading} (${cur.tag || cur.eqTag}): ${now.own ? words(now.off ? null : now) + ', for this plant' : 'follows the library again'}`, 'config'); if (V().persist) V().persist(); return { ok: true };
  }
  /* how many plant sensors a library value reaches */
  function reach(code, reading) { let follow = 0; let own = 0; arr(safe(() => V().plants(), [])).forEach((p) => sensorsAt(p.key).filter((x) => x.code === code && x.s.name === reading).forEach((x) => { if (plantStore(p.key)[x.s.id]) own++; else follow++; })); return { follow, own }; }
  if (W.V7OVX) W.V7OVX.register('cal', { base: (key, t) => { const p = plant(key, t.sensor); return p ? words(p.lib) : null; }, what: (key, t) => { const p = plant(key, t.sensor); return p ? { what: `${p.reading}${p.tag ? ' (' + p.tag + ')' : ''} · calibration`, eqId: p.eqId, tag: p.eqTag, typeName: p.typeName } : { what: 'Calibration' }; }, back: (key, t) => { delete plantStore(key)[t.sensor]; sync((k2, r) => k2 === key && r.s.id === t.sensor); } });
  if (W.V7PEND) W.V7PEND.register('cal', { id: (a) => `${a[0]}|${a[1]}`, check: (a) => check(a[0], a[1], a[2]), same: (a) => { const cur = lib(a[0], a[1]); if (a[2] == null) return !cur; const k = clean(a[2]); return !k.error && !!cur && sameCal(k, cur); }, apply: (a) => setLib(a[0], a[1], a[2]), lands: (a) => { const rc = reach(a[0], a[1]); return `Once published: ${rc.follow} ${rc.follow === 1 ? 'sensor follows' : 'sensors follow'} it${rc.own ? `, ${rc.own} ${rc.own === 1 ? 'keeps its' : 'keep their'} own` : ''}.`; } });
  W.V7CAL = { UNITS, KINDS, check, lib, setLib, plant, setPlant, everyFor, wants, flows, sync, reach, words };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip; const enc = encodeURIComponent; const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const told = (x) => `<b>${esc(cap(everyText(x)))}</b> · ${x.flowName ? `<a href="#/flows/${esc(enc(x.flowId))}">${esc(x.flowName)}</a> <span class="muted">(${x.steps} ${x.steps === 1 ? 'step' : 'steps'})</span>` : '<span class="cal-flag">no flow yet, so the person has no steps to follow</span>'}`;
  function libLine(code, reading) {
    const kind = kindOf(code, reading); if (!KINDS.includes(kind)) return ''; const x = lib(code, reading); const rc = reach(code, reading); const pv = W.V7PEND ? W.V7PEND.get('cal', `${code}|${reading}`) : null;
    const next = pv ? `<span class="pd-next">${W.V7PEND.chip()} ${esc(pv.args[2] ? words(pv.args[2]) : 'no calibration')} · <a href="#/library">publish it from the Library page</a></span>` : '';
    const at = rc.follow + rc.own ? `<span class="cal-at">${rc.follow} ${rc.follow === 1 ? 'sensor follows' : 'sensors follow'} this${rc.own ? `, ${rc.own} ${rc.own === 1 ? 'keeps its' : 'keep their'} own` : ''}</span>` : '';
    return `<div class="cal-line" data-cal="${esc(reading)}"><span class="cal-k">Calibration</span><span class="cal-v">${x ? told(x) : '<span class="muted">None. This reading is not calibrated on a schedule.</span>'} ${x && !x.set ? chip('Starter value', { tone: 'muted', title: 'Every probe is calibrated monthly as a first guess. Not reviewed with operations yet' }) : ''} ${at}${next}</span><span class="cal-a">${btn(x ? 'Change' : 'Set calibration', { act: 'cal:lib-open', data: { code, reading }, small: true, kind: 'ghost', title: 'Which calibration flow, and how often' })}</span></div>`;
  }
  function plantLine(key, sensorId) {
    const x = plant(key, sensorId); if (!x) return '';
    const src = x.own ? chip('Changed here', { tone: 'warn', title: 'This sensor keeps its own calibration; the library keeps its own' }) : x.lib ? chip('Follows the library', { tone: 'muted' }) : '';
    const task = x.off ? '' : x.task ? `<span class="cal-at">Its task: ${esc(x.task.name)}</span>` : `<span class="cal-at">Offered as the task “${esc(x.reading)} calibration” under <a href="#/p/${esc(enc(key))}/library">Alerts &amp; Tasks</a></span>`;
    return `<div class="cal-line" data-cal="${esc(sensorId)}"><span class="cal-k">Calibration</span><span class="cal-v">${x.off ? `<span class="muted">${x.own ? 'Switched off for this sensor.' : 'None. The library sets no calibration for this reading.'}</span>` : told(x)} ${src} ${task}</span><span class="cal-a">${btn(x.off ? 'Set calibration' : 'Change', { act: 'cal:open', data: { plant: key, sensor: sensorId }, small: true, kind: 'ghost', title: 'Which calibration flow, and how often, for this sensor' })}</span></div>`;
  }
  W.V7CAL.libLine = libLine; W.V7CAL.plantLine = plantLine;

  let ED = null;
  function drawEd() {
    const E = ED; const fs = flows(E.typeName); const opt = (f) => `<option value="${esc(f.id)}"${f.id === E.vals.flowId ? ' selected' : ''}>${esc(f.name)} (${arr(f.steps).length} steps)</option>`;
    const sel = `<select id="cal-flow"><option value=""${E.vals.flowId ? '' : ' selected'}>None yet</option>${fs.near.length ? `<optgroup label="For ${esc(E.typeName)}">${fs.near.map(opt).join('')}</optgroup>` : ''}${fs.any.length ? `<optgroup label="Other calibration flows">${fs.any.map(opt).join('')}</optgroup>` : ''}</select>`;
    const often = `<div class="cal-often"><span>Every</span><input type="number" min="1" max="60" step="1" id="cal-n" value="${esc(E.vals.n)}" aria-label="How many"><select id="cal-unit" aria-label="Days, weeks, months or years">${UNITS.map((u) => `<option value="${u}"${u === E.vals.unit ? ' selected' : ''}>${u}s</option>`).join('')}</select></div>`;
    U.modal({ title: `Calibration · ${E.reading}`,
      body: `<p class="la-n">${esc(E.key ? `${E.tag ? E.tag + ' on ' : 'On '}${E.eqTag}` : `${E.typeName} · library`)}</p>${U.field({ label: 'How often', html: often })}${U.field({ label: 'Calibration flow', hint: 'The steps the person follows. Flows are written under Flows.', html: sel })}<p class="la-n">${E.key ? (E.lib ? `The library says: ${esc(words(E.lib))}. Saving something else keeps it for this sensor only.` : 'The library sets no calibration for this reading, so this is this sensor\'s own.') : 'It waits with the other library changes until you publish it. Then every sensor of this reading that follows the library has it. Where a plant has no calibration task for it yet, the task is offered under its Alerts &amp; Tasks.'}</p>${E.key && W.V7OVX ? W.V7OVX.whyHtml() : ''}`,
      foot: (E.key && E.own ? btn('Back to the library\'s', { act: 'cal:reset', kind: 'ghost' }) : '') + (E.has ? btn('No calibration', { act: E.key ? 'cal:off' : 'cal:lib-off', kind: 'ghost', title: 'Stop calibrating this reading on a schedule' }) : '') + btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(E.key ? 'Save for this sensor' : 'Save', { act: E.key ? 'cal:save' : 'cal:lib-save', kind: 'primary' }) });
  }
  U.on('cal:lib-open', (el) => { const code = el.getAttribute('data-code'); const reading = el.getAttribute('data-reading'); const lt = safe(() => V().libType(code), null); if (!lt) return false; const pv = W.V7PEND ? W.V7PEND.get('cal', `${code}|${reading}`) : null; const x = pv ? (pv.args[2] ? { ...pv.args[2] } : null) : lib(code, reading);
    ED = { key: null, code, reading, typeName: lt.typeName, has: !!x, vals: x ? { n: x.n, unit: x.unit, flowId: x.flowId || '' } : { n: 6, unit: 'month', flowId: (flows(lt.typeName).near[0] || {}).id || W.CAL_FLOW_DEFAULT || '' } }; drawEd(); return false; });
  U.on('cal:open', (el) => { const key = el.getAttribute('data-plant'); const sensorId = el.getAttribute('data-sensor'); const x = plant(key, sensorId); if (!x) return false; const from = x.off ? x.lib : x;
    ED = { key, sensorId, reading: x.reading, typeName: x.typeName, tag: x.tag, eqTag: x.eqTag, own: x.own, lib: x.lib, has: !x.off, vals: from ? { n: from.n, unit: from.unit, flowId: from.flowId || '' } : { n: 6, unit: 'month', flowId: (flows(x.typeName).near[0] || {}).id || W.CAL_FLOW_DEFAULT || '' } }; drawEd(); return false; });
  const read = () => { const g = (id) => { const e = document.getElementById(id); return e ? e.value : ''; }; return { n: g('cal-n'), unit: g('cal-unit'), flowId: g('cal-flow') }; };
  const done = (r, msg) => { if (!r.ok) { U.toast(r.error); return false; } ED = null; U.closeModal(true); U.toast(msg); return undefined; };
  const libGo = (x) => { if (!ED) return false; if (!W.V7PEND) return done(setLib(ED.code, ED.reading, x), 'Saved.'); const k = x == null ? null : clean(x, ED.typeName); if (k && k.error) { U.toast(k.error); return false; } const r = W.V7PEND.stage('cal', [ED.code, ED.reading, k], `Calibration of ${ED.reading} on ${ED.typeName}: ${words(k)}`); return done(r, r.ok ? W.V7PEND.saved(r) : ''); };
  U.on('cal:lib-save', () => libGo(read()));
  U.on('cal:lib-off', () => libGo(null));
  const plantGo = (x, msg) => { if (!ED) return false; let why = null; if (W.V7OVX) { const w = W.V7OVX.readWhy(); if (!w.ok) { U.toast(w.error); return false; } why = w.opts; } return done(setPlant(ED.key, ED.sensorId, x, why), msg); };
  U.on('cal:save', () => plantGo(read(), 'Saved for this sensor. It is listed under Deviations.'));
  U.on('cal:off', () => plantGo('off', 'Calibration is switched off for this sensor. It is listed under Deviations.'));
  U.on('cal:reset', () => (ED ? done(setPlant(ED.key, ED.sensorId, null), 'It follows the library again.') : false));

  let busy = false;
  if (U.afterRender) U.afterRender((main, path) => {
    try {
      if (!busy) { busy = true; try { if (sync() && V().persist) V().persist(); } catch (e) { /* tasks stay as they were */ } busy = false; }
      if (!main) return; const p = String(path || location.hash).replace(/^#?\/?/, '').split('?')[0]; let m;
      const cards = () => Array.prototype.slice.call(main.querySelectorAll('article.o-rd[id^="r-"]')).filter((c) => !c.querySelector('.cal-line'));
      if ((m = /^library\/([^/]+)\/readings$/.exec(p))) { const code = decodeURIComponent(m[1]); cards().forEach((c) => { const html = libLine(code, c.id.slice(2)); if (html) c.insertAdjacentHTML('beforeend', html); }); return; }
      if ((m = /^p\/([^/]+)\/eq\/([^/]+)(\/readings)?$/.exec(p))) { const key = decodeURIComponent(m[1]); cards().forEach((c) => { const html = plantLine(key, c.id.slice(2)); if (html) c.insertAdjacentHTML('beforeend', html); }); }
    } catch (e) { /* the page still shows without it */ }
  });
})();
