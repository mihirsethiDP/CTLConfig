/* v7/7 and v7/8 · dyn78.js — calculated values (dynamic formulas), and the library's place for two levels.
   An alert's condition decides when an issue or a task opens. A calculated value opens nothing: it is a number worked out
   on the fly from readings, such as the pressure drop across a filter. Setting one up is optional.
   Like an alert it belongs to a level, and reads only the sensors inside that level:
     a piece of equipment · a unit process · a control group ('@group') · the whole plant ('@plant')

   window.V7DYN
     In the library:  defs(code) · saveDef(code, def) · removeDef(code, id)
       def = { id, name, unit, inputs: [{ reading, label }], expr }     expr uses the letters A, B, C… for the inputs
     At a plant:      offers(key) → { pid, tag, name, typeName, def, inputs: [{ letter, reading, label, found, pick, choose }],
                                       missing, choose, state: null | 'on' | 'off', value }
                      use(key, pid, 'on' | 'off' | null) · pick(key, pid, i, sensorId)
     compile(expr, n) → { fn, used } | { error } */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const UA = () => W.V7UPALERT;
  const arr = (x) => (Array.isArray(x) ? x : []); const clone = (x) => JSON.parse(JSON.stringify(x));
  const RD = (n) => (W.READINGS || {})[n] || null; const LET = 'ABCDEF';
  const typeOf = (code) => (UA() && UA().typeOf ? UA().typeOf(code) : null);
  function compile(src, n) {
    const s = String(src || '').replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').toUpperCase(); let i = 0; const used = new Set();
    const ws = () => { while (s[i] === ' ') i++; };
    function prim() { ws(); const c = s[i];
      if (c === '(') { i++; const v = sum(); ws(); if (s[i] !== ')') throw new Error('bracket'); i++; return v; }
      if (c === '-') { i++; const v = prim(); return (x) => -v(x); }
      const m = /^\d+(\.\d+)?/.exec(s.slice(i)); if (m) { i += m[0].length; const k = +m[0]; return () => k; }
      const li = c ? LET.indexOf(c) : -1; if (li >= 0 && li < n) { i++; used.add(li); return (x) => x[li]; } throw new Error('token'); }
    function prod() { let v = prim(); for (;;) { ws(); const c = s[i]; if (c !== '*' && c !== '/') return v; i++; const a = v; const b = prim(); v = c === '*' ? (x) => a(x) * b(x) : (x) => a(x) / b(x); } }
    function sum() { let v = prod(); for (;;) { ws(); const c = s[i]; if (c !== '+' && c !== '-') return v; i++; const a = v; const b = prod(); v = c === '+' ? (x) => a(x) + b(x) : (x) => a(x) - b(x); } }
    try { if (!s.trim()) throw new Error('empty'); const fn = sum(); ws(); if (i < s.length) throw new Error('rest'); return { fn, used }; } catch (e) { return { error: true }; }
  }
  const D = (id, name, unit, inputs, expr) => ({ id, name, unit, inputs: inputs.map(([reading, label]) => ({ reading, label: label || '' })), expr });
  /* what the library ships with: a first draft, to confirm */
  const SHIPPED = {
    '@plant': [D('dy_share', 'Treated share of the inflow', '%', [['Flow', 'Flow in'], ['Flow', 'Flow out']], 'B / A × 100')],
    '@group': [D('dy_amps', 'Combined motor current', 'A', [['Motor current', 'First'], ['Motor current', 'Second']], 'A + B')],
    equalization: [D('dy_spare', 'Spare room in the tank', '%', [['Level', '']], '100 − A')],
  };
  function libStore() { const L = V().S.lib; if (!L.dyn || typeof L.dyn !== 'object') L.dyn = {}; return L.dyn; }
  const defs = (code) => clone(libStore()[code] || SHIPPED[code] || []);
  const ownNames = (code) => arr((typeOf(code) || {}).sensors).map((s) => s.name);
  const isEqType = (code) => { const c = typeOf(code); return !!c && c.library !== 'process'; };
  function saveDef(code, x) {
    const c = typeOf(code); if (!c) return { ok: false, error: 'No such type.' }; const name = String((x && x.name) || '').trim(); if (!name) return { ok: false, error: 'Give it a name.' };
    const inputs = arr(x.inputs).map((q) => ({ reading: q.reading, label: String(q.label || '').trim() })); if (!inputs.length) return { ok: false, error: 'Add at least one reading for it to use.' }; if (inputs.length > LET.length) return { ok: false, error: `${LET.length} readings is the most.` };
    for (const q of inputs) { if (!RD(q.reading)) return { ok: false, error: 'Choose a kind of reading on every line.' }; if (isEqType(code) && !ownNames(code).includes(q.reading)) return { ok: false, error: `${c.type} does not have ${q.reading}. An equipment type reads only what sits on it.` }; }
    const k = compile(x.expr, inputs.length); if (k.error) return { ok: false, error: `The formula cannot be read. Use the letters ${LET.slice(0, inputs.length).split('').join(', ')}, numbers, + − × ÷ and brackets.` };
    const idle = inputs.map((q, i) => i).filter((i) => !k.used.has(i)); if (idle.length) return { ok: false, error: `The formula does not use ${idle.map((i) => LET[i]).join(' or ')}. Use it or remove that line.` };
    const list = defs(code); const i = x.id ? list.findIndex((d) => d.id === x.id) : -1; if (list.some((d, j) => j !== i && d.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: `${c.type} already has a calculated value called ${name}.` };
    const def = { id: i >= 0 ? list[i].id : 'dy_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name, unit: String(x.unit || '').trim(), inputs, expr: String(x.expr).trim() };
    if (i >= 0) list[i] = def; else list.push(def); libStore()[code] = list; V().log(null, `${c.type}: ${i >= 0 ? 'changed' : 'added'} the calculated value "${name}" (${words(def)})`, 'library'); if (V().persist) V().persist(); return { ok: true, def };
  }
  function removeDef(code, id) {
    const c = typeOf(code); const list = defs(code); const i = list.findIndex((d) => d.id === id); if (!c || i < 0) return { ok: false, error: 'No such calculated value.' };
    const at = UA() ? arr(V().plants()).find((p) => UA().offers(p.key).some((a) => a.state === 'applied' && a.typeId === code && a.conds.some((c) => c.calc === id))) : null; if (at) return { ok: false, error: `${at.name} has an alert that watches it. Leave that alert out there first.` };
    const al = UA() ? UA().alerts(code).find((a) => a.when.some((q) => q.calc === id)) : null; if (al) return { ok: false, error: `The alert "${al.name}" watches it. Change or remove that alert first.` };
    const [d] = list.splice(i, 1); libStore()[code] = list; V().log(null, `${c.type}: removed the calculated value "${d.name}"`, 'library'); if (V().persist) V().persist(); return { ok: true };
  }
  const nameOf = (q, i) => q.label || `${q.reading}${''}`;
  function words(def, o) { let out = String(def.expr).toUpperCase(); const ins = o ? o.inputs : def.inputs.map((q, i) => ({ ...q, letter: LET[i] })); return out.replace(/[A-F]/g, (L) => { const q = ins[LET.indexOf(L)]; if (!q) return L; const s = o && q.pick ? q.found.find((x) => x.id === q.pick) : null; return s ? s.tag : `[${nameOf(q)}]`; }); }
  /* at a plant */
  function plantStore(key) { const P = V().S.plants[key]; if (!P) return {}; if (!P.dyn || typeof P.dyn !== 'object') P.dyn = {}; return P.dyn; }
  /* v7/9: calculated values written at one plant, for that plant only. The library is not changed. */
  function ownStore(key) { const P = V().S.plants[key]; if (!P) return {}; if (!P.ownDyn || typeof P.ownDyn !== 'object') P.ownDyn = {}; return P.ownDyn; }
  const ownDefs = (key, subjId) => arr(ownStore(key)[subjId]).map((d) => ({ ...clone(d), plantOwn: true }));
  const defsAt = (key, subjId, typeId) => defs(typeId).concat(ownDefs(key, subjId));
  const ownPlaces = (key) => (UA() && UA().subjects ? UA().subjects(key).filter((u) => UA().scopeAny(key, u.id, u.sk).some((q) => RD(q.name))) : []);
  function saveOwn(key, subjId, x) {
    const u = UA() && UA().subjects ? UA().subjects(key).find((q) => q.id === subjId) : null; if (!u) return { ok: false, error: 'Choose where it sits.' }; const sc = UA().scopeAny(key, u.id, u.sk); x = x || {};
    const name = String(x.name || '').trim(); if (!name) return { ok: false, error: 'Give it a name.' };
    const inputs = arr(x.inputs).map((q) => ({ reading: q.reading, label: String(q.label || '').trim(), sensor: q.sensor || null })); if (!inputs.length) return { ok: false, error: 'Add at least one reading for it to use.' }; if (inputs.length > LET.length) return { ok: false, error: `${LET.length} readings is the most.` };
    for (let j = 0; j < inputs.length; j++) { const q = inputs[j]; const found = sc.filter((z) => z.name === q.reading); if (!RD(q.reading) || !found.length) return { ok: false, error: `Nothing in ${u.tag} sends that reading. Choose another for ${LET[j]}.` }; if (found.length === 1) q.sensor = found[0].id; else if (!found.some((z) => z.id === q.sensor)) return { ok: false, error: `Choose which ${q.reading} sensor ${LET[j]} reads.` }; }
    const k = compile(x.expr, inputs.length); if (k.error) return { ok: false, error: `The formula cannot be read. Use the letters ${LET.slice(0, inputs.length).split('').join(', ')}, numbers, + − × ÷ and brackets.` };
    const idle = inputs.map((q, j) => j).filter((j) => !k.used.has(j)); if (idle.length) return { ok: false, error: `The formula does not use ${idle.map((j) => LET[j]).join(' or ')}. Use it or remove that line.` };
    const st = ownStore(key); const list = arr(st[subjId]); const i = x.id ? list.findIndex((d) => d.id === x.id) : -1;
    const why = String(x.why || '').trim(); if (i < 0 && !why) return { ok: false, error: 'Say why this plant needs it.' };
    if (offers(key).some((o) => o.subjId === subjId && o.def.id !== (i >= 0 ? list[i].id : null) && o.def.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: `${u.tag} already has a calculated value called ${name}.` };
    const def = { id: i >= 0 ? list[i].id : 'pd_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name, unit: String(x.unit || '').trim(), inputs: inputs.map((q) => ({ reading: q.reading, label: q.label })), expr: String(x.expr).trim(), why: why || (i >= 0 ? list[i].why || '' : '') };
    if (i >= 0) list[i] = def; else list.push(def); st[subjId] = list; const pid = `${subjId}|${def.id}`; const ps = plantStore(key); const rec = ps[pid] || (ps[pid] = {}); rec.pick = {}; inputs.forEach((q, j) => { rec.pick[j] = q.sensor; }); if (i < 0) rec.state = 'on';
    const o = offer(key, pid); V().log(key, `${u.tag}: ${i >= 0 ? 'changed' : 'added'} a calculated value for this plant only, "${name}" (${o ? words(def, o) : def.expr})${i < 0 ? `. Why: ${why}` : ''}`, 'config'); if (V().persist) V().persist(); return { ok: true, pid, def };
  }
  function removeOwn(key, pid) {
    const subjId = String(pid).split('|')[0]; const id = String(pid).split('|')[1]; const st = ownStore(key); const list = arr(st[subjId]); const i = list.findIndex((d) => d.id === id); if (i < 0) return { ok: false, error: 'No such calculated value here.' };
    const by = UA() ? UA().offers(key).find((a) => a.upId === subjId && a.conds.some((c) => c.calc === id)) : null; if (by) return { ok: false, error: `The alert "${by.name}" on ${by.upTag} watches it. Change or remove that alert first.` };
    const [d] = list.splice(i, 1); if (list.length) st[subjId] = list; else delete st[subjId]; delete plantStore(key)[pid];
    V().log(key, `Removed the calculated value "${d.name}", which was at this plant only`, 'config'); if (V().persist) V().persist(); return { ok: true };
  }
  function offers(key) {
    const out = []; if (!UA() || !UA().subjects) return out;
    UA().subjects(key).forEach((u) => { const list = defsAt(key, u.id, u.typeId); if (!list.length) return; const sc = UA().scopeAny(key, u.id, u.sk);
      list.forEach((def) => { const pid = `${u.id}|${def.id}`; const rec = plantStore(key)[pid] || {}; const picks = rec.pick || {}; const taken = new Set();
        const inputs = def.inputs.map((q, i) => { const found = sc.filter((s) => s.name === q.reading); let pk = picks[i] && found.some((s) => s.id === picks[i]) ? picks[i] : null; if (!pk && found.length === 1) pk = found[0].id; if (pk) taken.add(pk); return { letter: LET[i], reading: q.reading, label: q.label, found, pick: pk, choose: found.length > 1 && !pk }; });
        const need = {}; inputs.forEach((q) => { need[q.reading] = (need[q.reading] || 0) + 1; });
        const few = [...new Set(inputs.filter((q) => q.found.length && q.found.length < need[q.reading]).map((q) => q.reading))].map((r) => ({ reading: r, need: need[r], has: inputs.find((q) => q.reading === r).found.length }));
        const missing = [...new Set(inputs.filter((q) => !q.found.length).map((q) => q.reading))].concat(few.map((f) => f.reading)); const choose = !missing.length && inputs.some((q) => q.choose);
        let value = null; if (!missing.length && !choose) { const vals = inputs.map((q) => { const s = q.found.find((x) => x.id === q.pick); return s && s.v != null ? +s.v : NaN; }); const k = compile(def.expr, inputs.length); const r = k.error ? NaN : k.fn(vals); if (Number.isFinite(r)) value = Math.round(r * 100) / 100; }
        out.push({ pid, subjId: u.id, tag: u.tag, name: u.name, typeId: u.typeId, typeName: u.typeName, sk: u.sk, def, inputs, missing, few, choose, state: rec.state || null, value, mine: !!def.plantOwn, why: def.why || '' }); }); });
    return out;
  }
  const why = (o) => { const none = o.missing.filter((r) => !o.few.some((f) => f.reading === r)); return [none.length ? `nothing in ${o.tag} sends ${none.join(' or ')}.` : '', ...o.few.map((f) => `it needs ${f.need} ${f.reading} sensors and ${o.tag} has ${f.has}.`)].filter(Boolean).join(' Also, '); };
  const offer = (key, pid) => offers(key).find((o) => o.pid === pid) || null;
  function use(key, pid, state) {
    const o = offer(key, pid); if (!o) return { ok: false, error: 'No such calculated value here.' }; const st = plantStore(key);
    if (state === 'on' && o.missing.length) return { ok: false, error: `It cannot be worked out here: ${why(o)}` };
    if (state === 'on' && o.choose) return { ok: false, error: `Choose which sensor to use for ${o.inputs.filter((q) => q.choose).map((q) => q.label || q.reading).join(' and ')} first.` };
    if (state !== 'on' && o.state === 'on' && W.V7UPALERT) { const by = W.V7UPALERT.offers(key).find((a) => a.state === 'applied' && a.conds.some((c) => c.dyn && c.dyn.pid === pid)); if (by) return { ok: false, error: `The alert "${by.name}" on ${by.upTag} reads it. Leave that alert out first.` }; }
    const rec = st[pid] || (st[pid] = {}); if (state == null) delete rec.state; else rec.state = state; if (!rec.state && !rec.pick) delete st[pid];
    V().log(key, state === 'on' ? `${o.tag}: now works out "${o.def.name}" (${words(o.def, o)})` : state === 'off' ? `${o.tag}: "${o.def.name}" is not used here` : `${o.tag}: "${o.def.name}" is undecided again`, 'config'); if (V().persist) V().persist(); return { ok: true };
  }
  function pick(key, pid, i, sensorId) {
    const o = offer(key, pid); if (!o) return { ok: false, error: 'No such calculated value here.' }; const q = o.inputs[+i]; if (!q) return { ok: false, error: 'No such reading on it.' };
    if (sensorId && !q.found.some((s) => s.id === sensorId)) return { ok: false, error: `That is not a ${q.reading} sensor in ${o.tag}.` };
    const st = plantStore(key); const rec = st[pid] || (st[pid] = {}); rec.pick = rec.pick || {}; if (sensorId) rec.pick[+i] = sensorId; else delete rec.pick[+i]; if (V().persist) V().persist(); return { ok: true };
  }
  const watchersOf = (uaAll, o) => arr(uaAll).filter((a) => a.upId === o.subjId && a.state === 'applied' && a.conds.some((c) => c.calc === o.def.id));
  W.V7DYN = { watchersOf, defsAt, saveOwn, removeOwn, ownPlaces, compile, defs, saveDef, removeDef, offers, offer, use, pick, words, libBox: () => '' };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip;
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b || a + 's'}`;
  const usesHtml = (def) => def.inputs.map((q, i) => `<span class="dy-in"><b>${LET[i]}</b> ${esc(q.label ? `${q.label} (${q.reading})` : q.reading)}</span>`).join('');
  function libBox(code) {
    const c = typeOf(code); if (!c) return ''; if (isEqType(code) && !ownNames(code).length) return ''; const list = defs(code);
    const rows = list.map((d) => `<li class="ua-row"><div class="ua-main"><div class="ua-t"><b>${esc(d.name)}</b>${d.unit ? ` <span class="dy-u">in ${esc(d.unit)}</span>` : ''}</div><div class="ua-w dy-f">= ${esc(d.expr)}</div><div class="ua-s dy-ins">${usesHtml(d)}</div></div><div class="ua-acts">${btn('Edit', { act: 'dy:lib-open', data: { code, id: d.id }, small: true })}${btn('Remove', { act: 'dy:lib-remove', data: { code, id: d.id }, small: true, kind: 'ghost' })}</div></li>`).join('');
    return `<section class="ov-box ua-box ua-solo dy-box"><header><h3>Calculated values</h3><span class="ov-n">${list.length}</span><span class="ov-hb">${btn('Add a calculated value', { act: 'dy:lib-open', data: { code }, small: true, kind: 'secondary', title: 'A number worked out on the fly from readings' })}</span></header><div class="ov-b"><p class="ov-sub ua-lead">Optional. A number worked out on the fly from readings, such as a difference or a share. On its own it opens no issue and no task; an alert on this type may watch it. Each plant is offered it, and chooses the exact sensors.</p>${rows ? `<ul class="ua-rows">${rows}</ul>` : '<p class="ov-none">None yet.</p>'}</div></section>`;
  }
  W.V7DYN.libBox = libBox;
  let ED = null;
  function readEd() { if (!ED) return; const g = (id) => { const e = document.getElementById(id); return e ? e.value : null; }; ['name', 'unit', 'expr'].forEach((k) => { const v = g('dy-' + k); if (v != null) ED[k] = v; }); ED.inputs.forEach((q, i) => { const r = g('dy-r' + i); if (r != null) q.reading = r; const l = g('dy-l' + i); if (l != null) q.label = l; if (ED.mine) { const z = g('dy-s' + i); q.sensor = z || null; } }); if (ED.mine) { const y = g('dy-why'); if (y != null) ED.why = y; } }
  function drawEd() {
    const E = ED; const sc = E.mine ? UA().scopeAny(E.key, E.subjId, E.sk) : null; const names = (sc ? [...new Set(sc.map((q) => q.name))] : isEqType(E.code) ? ownNames(E.code) : Object.keys(W.READINGS || {})).filter((n) => RD(n));
    const sensF = (q, i) => { if (!sc) return ''; const found = sc.filter((z) => z.name === q.reading); return found.length > 1 ? `<select id="dy-s${i}" aria-label="Which sensor ${LET[i]} reads"><option value="">Choose the sensor…</option>${found.map((z) => `<option value="${esc(z.id)}"${q.sensor === z.id ? ' selected' : ''}>${esc(z.tag)}${z.onPipe ? ' (pipe)' : ''}${z.eqTag ? ' · ' + esc(z.eqTag) : ''}</option>`).join('')}</select>` : found.length === 1 ? `<span class="dy-one">from ${esc(found[0].tag)}</span>` : ''; };
    const rows = E.inputs.map((q, i) => `<div class="dy-er"><span class="dy-let">${LET[i]}</span><select id="dy-r${i}"${E.mine ? ' data-act="dy:own-set"' : ''} aria-label="Kind of reading for ${LET[i]}">${names.map((n) => `<option value="${esc(n)}"${n === q.reading ? ' selected' : ''}>${esc(n)}${RD(n).unit ? ` (${esc(RD(n).unit)})` : ''}</option>`).join('')}</select><input type="text" id="dy-l${i}" value="${esc(q.label || '')}" placeholder="What to call it, if two are alike" aria-label="Name for ${LET[i]}">${sensF(q, i)}${E.inputs.length > 1 ? btn('Remove', { act: E.mine ? 'dy:own-in-del' : 'dy:in-del', data: { i }, small: true, kind: 'ghost' }) : ''}</div>`).join('');
    const lvl = (u) => (u.sk === 'eq' ? 'Equipment' : u.sk === 'group' ? 'Control groups' : u.sk === 'plant' ? 'The whole plant' : 'Unit processes');
    const whereF = E.mine && E.isNew ? (() => { const ps = ownPlaces(E.key); return U.field({ label: 'Where it sits', hint: 'It reads only the sensors inside this place.', html: `<select id="dy-where" data-act="dy:where">${['The whole plant', 'Unit processes', 'Equipment', 'Control groups'].map((L) => { const xs = ps.filter((u) => lvl(u) === L); return xs.length ? `<optgroup label="${L}">${xs.map((u) => `<option value="${esc(u.id)}"${u.id === E.subjId ? ' selected' : ''}>${esc(u.tag)}${u.sk === 'plant' ? '' : ' · ' + esc(u.sk === 'group' ? u.name : u.typeName || u.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>` }); })() : '';
    U.modal({ title: E.mine ? (E.id ? `${E.tag}: ${E.name}` : 'Add a calculated value for this plant only') : E.id ? `Edit a calculated value of ${E.typeName}` : `Add a calculated value to ${E.typeName}`, wide: true,
      body: whereF + `<div class="la-2">${U.field({ label: 'Name', html: `<input type="text" id="dy-name" value="${esc(E.name)}" placeholder="For example: Pressure drop across the filter">` })}${U.field({ label: 'Unit', hint: 'Optional.', html: `<input type="text" id="dy-unit" value="${esc(E.unit)}" placeholder="bar, %, m³/h">` })}</div>`
        + `<div class="field"><span class="field-l">Readings it uses</span><div class="dy-ed">${rows}</div><div class="ua-add">${E.inputs.length < LET.length ? btn('Add another reading', { act: E.mine ? 'dy:own-in-add' : 'dy:in-add', small: true, kind: 'secondary' }) : ''}</div></div>`
        + U.field({ label: 'Formula', hint: `Use the letters ${LET.slice(0, E.inputs.length).split('').join(', ')}, numbers, + − × ÷ and brackets. For example: (A − B) ÷ A × 100`, html: `<input type="text" id="dy-expr" class="dy-expr" value="${esc(E.expr)}" placeholder="A − B">` })
        + (E.mine ? U.field({ label: 'Why this plant needs it', hint: E.id ? '' : 'Kept with the value and written to Activity.', html: `<input type="text" id="dy-why" value="${esc(E.why || '')}" placeholder="For example: the client reports this number every month">` }) + '<p class="la-n">It is worked out on the latest readings of the sensors chosen here. It exists at this plant only: the library is not changed, and no other plant is offered it. It opens an issue only through an alert that watches it: once saved, press "Add an alert on this" on its row.</p>' : '<p class="la-n">It is written against kinds of reading. At each plant the person setting it up picks the exact sensor for every letter, from the sensors inside the same level only.</p>'),
      foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(E.id ? 'Save' : 'Add', { act: E.mine ? 'dy:own-save' : 'dy:lib-save', kind: 'primary' }) });
  }
  U.on('dy:lib-open', (el) => { const code = el.getAttribute('data-code'); const id = el.getAttribute('data-id'); const c = typeOf(code); if (!c) return false; const d = id ? defs(code).find((x) => x.id === id) : null; const first = (isEqType(code) ? ownNames(code) : Object.keys(W.READINGS || {}))[0];
    ED = d ? { code, typeName: c.type, ...clone(d) } : { code, typeName: c.type, id: null, name: '', unit: '', inputs: [{ reading: first, label: '' }], expr: '' }; drawEd(); return false; });
  U.on('dy:in-add', () => { readEd(); if (!ED) return false; ED.inputs.push({ reading: ED.inputs[ED.inputs.length - 1].reading, label: '' }); drawEd(); return false; });
  U.on('dy:in-del', (el) => { readEd(); if (!ED) return false; ED.inputs.splice(+el.getAttribute('data-i'), 1); drawEd(); return false; });
  U.on('dy:lib-save', () => { readEd(); if (!ED) return false; const r = saveDef(ED.code, ED); if (!r.ok) { U.toast(r.error); return false; } ED = null; U.closeModal(true); U.toast('Saved. Plants are offered it as an optional step.'); return undefined; });
  const ownIn = (key, u) => { const n = [...new Set(UA().scopeAny(key, u.id, u.sk).map((q) => q.name))].find((q) => RD(q)); return { reading: n, label: '', sensor: null }; };
  U.on('dy:own-open', (el) => { const key = el.getAttribute('data-plant'); const pid = el.getAttribute('data-pid'); if (pid) { const o = offer(key, pid); if (!o || !o.mine) return false; ED = { mine: true, isNew: false, key, subjId: o.subjId, sk: o.sk, tag: o.tag, id: o.def.id, name: o.def.name, unit: o.def.unit || '', expr: o.def.expr, why: o.why || '', inputs: o.inputs.map((q) => ({ reading: q.reading, label: q.label || '', sensor: q.pick || null })) }; drawEd(); return false; }
    const ps = ownPlaces(key); if (!ps.length) { U.toast('Nothing here sends a reading yet. Read the plant in first.'); return false; } const u = ps.find((q) => q.sk === 'plant') || ps[0];
    ED = { mine: true, isNew: true, key, subjId: u.id, sk: u.sk, tag: u.tag, id: null, name: '', unit: '', expr: '', why: '', inputs: [ownIn(key, u)] }; drawEd(); return false; });
  U.on('dy:where', (el) => { if (!ED || !ED.mine) return false; readEd(); const u = ownPlaces(ED.key).find((q) => q.id === el.value); if (!u) return false; Object.assign(ED, { subjId: u.id, sk: u.sk, tag: u.tag, inputs: [ownIn(ED.key, u)] }); drawEd(); return false; });
  U.on('dy:own-set', (el) => { if (!ED || !ED.mine) return false; const before = ED.inputs.map((q) => q.reading); readEd(); ED.inputs.forEach((q, i) => { if (q.reading !== before[i]) q.sensor = null; }); drawEd(); const f = document.getElementById(el.id); if (f) f.focus(); return false; });
  U.on('dy:own-in-add', () => { readEd(); if (!ED) return false; ED.inputs.push({ reading: ED.inputs[ED.inputs.length - 1].reading, label: '', sensor: null }); drawEd(); return false; });
  U.on('dy:own-in-del', (el) => { readEd(); if (!ED) return false; ED.inputs.splice(+el.getAttribute('data-i'), 1); drawEd(); return false; });
  U.on('dy:own-save', () => { readEd(); if (!ED || !ED.mine) return false; const r = saveOwn(ED.key, ED.subjId, ED); if (!r.ok) { U.toast(r.error); return false; } const isNew = ED.isNew; ED = null; U.closeModal(true); U.toast(isNew ? 'Added for this plant only. Add an alert on it to open an issue.' : 'Saved for this plant.'); return undefined; });
  U.on('dy:own-remove', (el) => { const r = removeOwn(el.getAttribute('data-plant'), el.getAttribute('data-pid')); U.toast(r.ok ? 'Removed. It was at this plant only.' : r.error); return undefined; });
  U.on('dy:lib-remove', (el) => { const r = removeDef(el.getAttribute('data-code'), el.getAttribute('data-id')); U.toast(r.ok ? 'Removed.' : r.error); return undefined; });
  U.on('dy:use', (el) => { const st = el.getAttribute('data-state'); const r = use(el.getAttribute('data-plant'), el.getAttribute('data-pid'), st === 'none' ? null : st); U.toast(r.ok ? (st === 'on' ? 'In use. It is worked out from now on.' : st === 'off' ? 'Not used here.' : 'Undecided again.') : r.error); return undefined; });
  U.on('dy:pick', (el) => { const r = pick(el.getAttribute('data-plant'), el.getAttribute('data-pid'), el.getAttribute('data-i'), el.value); if (!r.ok) U.toast(r.error); return undefined; });

  /* folded cards, as the criticality card: one line until opened, and they stay open across a change */
  const OPEN = {}; const fold = (id, title, line, inner) => `<details class="card p7-fold dy-card" id="${id}"${OPEN[id] ? ' open' : ''}><summary class="p7-fold-s"><span class="p7-fold-m"><span class="p7-fold-t">${esc(title)}</span><span class="p7-fold-d">${esc(line)}</span></span></summary><div class="dy-body">${inner}</div></details>`;
  document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.id && /^dy-/.test(d.id) && d.classList && d.classList.contains('dy-card')) OPEN[d.id] = d.open; }, true);
  function levelsCard() {
    const ua = UA(); const n = (code) => (ua ? ua.alerts(code).length : 0);
    return fold('dy-levels', 'Control groups and the whole plant', `Alerts and calculated values that read across a control group, or across the plant: ${plural(n('@group') + n('@plant'), 'alert')}, ${plural(defs('@group').length + defs('@plant').length, 'calculated value')}. Equipment and unit processes have theirs on their own type.`,
      `<div class="dy-lv"><h3 class="dy-lvh">A control group</h3>${ua ? ua.libBox({ code: '@group' }, { solo: true }) : ''}${libBox('@group')}</div><div class="dy-lv"><h3 class="dy-lvh">The whole plant</h3>${ua ? ua.libBox({ code: '@plant' }, { solo: true }) : ''}${libBox('@plant')}</div>`);
  }
  /* v7/9: which applied alerts watch a value. Worked out once per card: an alert's offer already carries the values it reads */
  function plantCard(key) {
    const all = offers(key); if (!all.length) return ''; const uaAll = UA() ? UA().offers(key) : []; const on = all.filter((o) => watchersOf(uaAll, o).length).length; const groups = [];
    all.forEach((o) => { let g = groups.find((x) => x.id === o.subjId + '|' + (o.sk || '')); if (!g) groups.push(g = { id: o.subjId + '|' + (o.sk || ''), tag: o.tag, name: o.name, typeName: o.typeName, rows: [] }); g.rows.push(o); });
    const row = (o) => {
      const ws = watchersOf(uaAll, o);
      const acts = o.missing.length || o.choose ? '' : btn('Add an alert on this', { act: 'ua:own-open', data: { plant: key, subj: o.subjId, calc: o.def.id }, small: true, kind: ws.length ? 'secondary' : 'primary', title: 'Opens the alert form with this value already chosen. The alert is what opens an issue' });
      const st = o.missing.length ? chip('Cannot be worked out here', { tone: 'warn' }) : o.choose ? chip('Choose a sensor', { tone: 'warn' }) : ws.length ? chip(ws.length === 1 ? 'Watched by an alert' : `Watched by ${ws.length} alerts`, { tone: 'ok' }) : chip('Not used by anything yet', { tone: 'muted', title: 'It opens an issue only through an alert that watches it' });
      const used = ws.length ? `<div class="ua-s">Watched by ${ws.map((a) => `“${esc(a.name)}” ${U.sev(a.band)}`).join(', ')}</div>` : '';
      const picks = o.missing.length ? '' : o.inputs.map((q, i) => (q.found.length > 1 ? `<label class="ua-pick${q.choose ? ' is-todo' : ''}"><span><b>${q.letter}</b> ${esc(q.label || q.reading)} from</span><select data-act="dy:pick" data-plant="${esc(key)}" data-pid="${esc(o.pid)}" data-i="${i}" aria-label="Which ${esc(q.reading)} sensor for ${q.letter}"><option value="">Choose the sensor…</option>${q.found.map((x) => `<option value="${esc(x.id)}"${q.pick === x.id ? ' selected' : ''}>${esc(x.tag)}${x.onPipe ? ' (pipe)' : ''}${x.eqTag ? ' · ' + esc(x.eqTag) : ''}</option>`).join('')}</select></label>` : '')).join('');
      const miss = o.missing.length ? `<div class="ua-miss">${esc(why(o).replace(/^./, (c) => c.toUpperCase()))} Add the sensor in the Visualization and read again.</div>` : '';
      const val = o.value != null ? `<span class="dy-now" title="Worked out on the latest readings">${esc(o.value)}${o.def.unit ? ' ' + esc(o.def.unit) : ''} now</span>` : '';
      return `<li class="ua-row${o.missing.length ? ' is-skip' : ''}"><div class="ua-main"><div class="ua-t"><b>${esc(o.def.name)}</b>${o.def.unit ? ` <span class="dy-u">in ${esc(o.def.unit)}</span>` : ''} ${st}${o.mine ? ` ${chip('This plant only', { tone: 'info', title: 'Added at this plant. The library does not have it' })}` : ''}</div><div class="ua-w dy-f">= ${esc(words(o.def, o))} ${val}</div>${picks && !o.mine ? `<div class="ua-picks">${picks}</div>` : ''}${used}${miss}</div><div class="ua-acts">${acts}${o.mine ? btn('Edit', { act: 'dy:own-open', data: { plant: key, pid: o.pid }, small: true }) + btn('Remove', { act: 'dy:own-remove', data: { plant: key, pid: o.pid }, small: true, kind: 'ghost' }) : ''}</div></li>`;
    };
    return fold('dy-plant', 'Calculated values', `Numbers worked out on the fly from this plant's readings. A value opens an issue only through an alert that watches it: ${plural(all.filter((o) => !o.mine).length, 'offered', 'offered')} by the library${all.some((o) => o.mine) ? `, ${all.filter((o) => o.mine).length} added here` : ''}, ${on} watched by an alert.`,
      groups.map((g) => `<div class="ua-up"><p class="ua-uph"><b>${esc(g.tag)}</b> ${esc(g.name)} <span class="ua-upt">${esc(g.typeName)}</span></p><ul class="ua-rows">${g.rows.map(row).join('')}</ul></div>`).join(''));
  }
  if (U.afterRender) U.afterRender((main, path) => {
    try {
      if (!main) return; const p = String(path || location.hash).replace(/^#?\/?/, '').split('?')[0]; let m; const body = main.querySelector('.pg-main'); if (!body) return;
      const after = (html) => { const ct = main.querySelector('#ct-card'); if (ct) ct.insertAdjacentHTML('afterend', html); else body.insertAdjacentHTML('afterbegin', html); };
      if (p === 'library') { if (!main.querySelector('#dy-levels')) after(levelsCard()); return; }
      if ((m = /^p\/([^/]+)\/library$/.exec(p))) { if (!main.querySelector('#dy-plant')) { const html = plantCard(decodeURIComponent(m[1])); if (html) after(html); } return; }
      if ((m = /^library\/([^/]+)(\/(readings|overview))?$/.exec(p))) { if (main.querySelector('.dy-box')) return; const html = libBox(decodeURIComponent(m[1])); if (!html) return; const ub = main.querySelector('.ua-box'); if (ub) ub.insertAdjacentHTML('afterend', html); else body.insertAdjacentHTML('beforeend', html); }
    } catch (e) { /* the page still shows without it */ }
  });
})();
