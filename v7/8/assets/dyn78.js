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
    const at = arr(V().plants()).find((p) => offers(p.key).some((o) => o.def.id === id && o.typeId === code && o.state === 'on')); if (at) return { ok: false, error: `${at.name} uses it. Turn it off there first.` };
    const [d] = list.splice(i, 1); libStore()[code] = list; V().log(null, `${c.type}: removed the calculated value "${d.name}"`, 'library'); if (V().persist) V().persist(); return { ok: true };
  }
  const nameOf = (q, i) => q.label || `${q.reading}${''}`;
  function words(def, o) { let out = String(def.expr).toUpperCase(); const ins = o ? o.inputs : def.inputs.map((q, i) => ({ ...q, letter: LET[i] })); return out.replace(/[A-F]/g, (L) => { const q = ins[LET.indexOf(L)]; if (!q) return L; const s = o && q.pick ? q.found.find((x) => x.id === q.pick) : null; return s ? s.tag : `[${nameOf(q)}]`; }); }
  /* at a plant */
  function plantStore(key) { const P = V().S.plants[key]; if (!P) return {}; if (!P.dyn || typeof P.dyn !== 'object') P.dyn = {}; return P.dyn; }
  function offers(key) {
    const out = []; if (!UA() || !UA().subjects) return out;
    UA().subjects(key).forEach((u) => { const list = defs(u.typeId); if (!list.length) return; const sc = UA().scopeAny(key, u.id, u.sk);
      list.forEach((def) => { const pid = `${u.id}|${def.id}`; const rec = plantStore(key)[pid] || {}; const picks = rec.pick || {}; const taken = new Set();
        const inputs = def.inputs.map((q, i) => { const found = sc.filter((s) => s.name === q.reading); let pk = picks[i] && found.some((s) => s.id === picks[i]) ? picks[i] : null; if (!pk && found.length === 1) pk = found[0].id; if (pk) taken.add(pk); return { letter: LET[i], reading: q.reading, label: q.label, found, pick: pk, choose: found.length > 1 && !pk }; });
        const need = {}; inputs.forEach((q) => { need[q.reading] = (need[q.reading] || 0) + 1; });
        const few = [...new Set(inputs.filter((q) => q.found.length && q.found.length < need[q.reading]).map((q) => q.reading))].map((r) => ({ reading: r, need: need[r], has: inputs.find((q) => q.reading === r).found.length }));
        const missing = [...new Set(inputs.filter((q) => !q.found.length).map((q) => q.reading))].concat(few.map((f) => f.reading)); const choose = !missing.length && inputs.some((q) => q.choose);
        let value = null; if (!missing.length && !choose) { const vals = inputs.map((q) => { const s = q.found.find((x) => x.id === q.pick); return s && s.v != null ? +s.v : NaN; }); const k = compile(def.expr, inputs.length); const r = k.error ? NaN : k.fn(vals); if (Number.isFinite(r)) value = Math.round(r * 100) / 100; }
        out.push({ pid, subjId: u.id, tag: u.tag, name: u.name, typeId: u.typeId, typeName: u.typeName, sk: u.sk, def, inputs, missing, few, choose, state: rec.state || null, value }); }); });
    return out;
  }
  const why = (o) => { const none = o.missing.filter((r) => !o.few.some((f) => f.reading === r)); return [none.length ? `nothing in ${o.tag} sends ${none.join(' or ')}.` : '', ...o.few.map((f) => `it needs ${f.need} ${f.reading} sensors and ${o.tag} has ${f.has}.`)].filter(Boolean).join(' Also, '); };
  const offer = (key, pid) => offers(key).find((o) => o.pid === pid) || null;
  function use(key, pid, state) {
    const o = offer(key, pid); if (!o) return { ok: false, error: 'No such calculated value here.' }; const st = plantStore(key);
    if (state === 'on' && o.missing.length) return { ok: false, error: `It cannot be worked out here: ${why(o)}` };
    if (state === 'on' && o.choose) return { ok: false, error: `Choose which sensor to use for ${o.inputs.filter((q) => q.choose).map((q) => q.label || q.reading).join(' and ')} first.` };
    const rec = st[pid] || (st[pid] = {}); if (state == null) delete rec.state; else rec.state = state; if (!rec.state && !rec.pick) delete st[pid];
    V().log(key, state === 'on' ? `${o.tag}: now works out "${o.def.name}" (${words(o.def, o)})` : state === 'off' ? `${o.tag}: "${o.def.name}" is not used here` : `${o.tag}: "${o.def.name}" is undecided again`, 'config'); if (V().persist) V().persist(); return { ok: true };
  }
  function pick(key, pid, i, sensorId) {
    const o = offer(key, pid); if (!o) return { ok: false, error: 'No such calculated value here.' }; const q = o.inputs[+i]; if (!q) return { ok: false, error: 'No such reading on it.' };
    if (sensorId && !q.found.some((s) => s.id === sensorId)) return { ok: false, error: `That is not a ${q.reading} sensor in ${o.tag}.` };
    const st = plantStore(key); const rec = st[pid] || (st[pid] = {}); rec.pick = rec.pick || {}; if (sensorId) rec.pick[+i] = sensorId; else delete rec.pick[+i]; if (V().persist) V().persist(); return { ok: true };
  }
  W.V7DYN = { compile, defs, saveDef, removeDef, offers, offer, use, pick, words, libBox: () => '' };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip;
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b || a + 's'}`;
  const usesHtml = (def) => def.inputs.map((q, i) => `<span class="dy-in"><b>${LET[i]}</b> ${esc(q.label ? `${q.label} (${q.reading})` : q.reading)}</span>`).join('');
  function libBox(code) {
    const c = typeOf(code); if (!c) return ''; if (isEqType(code) && !ownNames(code).length) return ''; const list = defs(code);
    const rows = list.map((d) => `<li class="ua-row"><div class="ua-main"><div class="ua-t"><b>${esc(d.name)}</b>${d.unit ? ` <span class="dy-u">in ${esc(d.unit)}</span>` : ''}</div><div class="ua-w dy-f">= ${esc(d.expr)}</div><div class="ua-s dy-ins">${usesHtml(d)}</div></div><div class="ua-acts">${btn('Edit', { act: 'dy:lib-open', data: { code, id: d.id }, small: true })}${btn('Remove', { act: 'dy:lib-remove', data: { code, id: d.id }, small: true, kind: 'ghost' })}</div></li>`).join('');
    return `<section class="ov-box ua-box ua-solo dy-box"><header><h3>Calculated values</h3><span class="ov-n">${list.length}</span><span class="ov-hb">${btn('Add a calculated value', { act: 'dy:lib-open', data: { code }, small: true, kind: 'secondary', title: 'A number worked out on the fly from readings' })}</span></header><div class="ov-b"><p class="ov-sub ua-lead">Optional. A number worked out on the fly from readings, such as a difference or a share. It opens no issue and no task. Each plant is offered it, and chooses the exact sensors.</p>${rows ? `<ul class="ua-rows">${rows}</ul>` : '<p class="ov-none">None yet.</p>'}</div></section>`;
  }
  W.V7DYN.libBox = libBox;
  let ED = null;
  function readEd() { if (!ED) return; const g = (id) => { const e = document.getElementById(id); return e ? e.value : null; }; ['name', 'unit', 'expr'].forEach((k) => { const v = g('dy-' + k); if (v != null) ED[k] = v; }); ED.inputs.forEach((q, i) => { const r = g('dy-r' + i); if (r != null) q.reading = r; const l = g('dy-l' + i); if (l != null) q.label = l; }); }
  function drawEd() {
    const E = ED; const names = (isEqType(E.code) ? ownNames(E.code) : Object.keys(W.READINGS || {})).filter((n) => RD(n));
    const rows = E.inputs.map((q, i) => `<div class="dy-er"><span class="dy-let">${LET[i]}</span><select id="dy-r${i}" aria-label="Kind of reading for ${LET[i]}">${names.map((n) => `<option value="${esc(n)}"${n === q.reading ? ' selected' : ''}>${esc(n)}${RD(n).unit ? ` (${esc(RD(n).unit)})` : ''}</option>`).join('')}</select><input type="text" id="dy-l${i}" value="${esc(q.label || '')}" placeholder="What to call it, if two are alike" aria-label="Name for ${LET[i]}">${E.inputs.length > 1 ? btn('Remove', { act: 'dy:in-del', data: { i }, small: true, kind: 'ghost' }) : ''}</div>`).join('');
    U.modal({ title: E.id ? `Edit a calculated value of ${E.typeName}` : `Add a calculated value to ${E.typeName}`, wide: true,
      body: `<div class="la-2">${U.field({ label: 'Name', html: `<input type="text" id="dy-name" value="${esc(E.name)}" placeholder="For example: Pressure drop across the filter">` })}${U.field({ label: 'Unit', hint: 'Optional.', html: `<input type="text" id="dy-unit" value="${esc(E.unit)}" placeholder="bar, %, m³/h">` })}</div>`
        + `<div class="field"><span class="field-l">Readings it uses</span><div class="dy-ed">${rows}</div><div class="ua-add">${E.inputs.length < LET.length ? btn('Add another reading', { act: 'dy:in-add', small: true, kind: 'secondary' }) : ''}</div></div>`
        + U.field({ label: 'Formula', hint: `Use the letters ${LET.slice(0, E.inputs.length).split('').join(', ')}, numbers, + − × ÷ and brackets. For example: (A − B) ÷ A × 100`, html: `<input type="text" id="dy-expr" class="dy-expr" value="${esc(E.expr)}" placeholder="A − B">` })
        + '<p class="la-n">It is written against kinds of reading. At each plant the person setting it up picks the exact sensor for every letter, from the sensors inside the same level only.</p>',
      foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(E.id ? 'Save' : 'Add', { act: 'dy:lib-save', kind: 'primary' }) });
  }
  U.on('dy:lib-open', (el) => { const code = el.getAttribute('data-code'); const id = el.getAttribute('data-id'); const c = typeOf(code); if (!c) return false; const d = id ? defs(code).find((x) => x.id === id) : null; const first = (isEqType(code) ? ownNames(code) : Object.keys(W.READINGS || {}))[0];
    ED = d ? { code, typeName: c.type, ...clone(d) } : { code, typeName: c.type, id: null, name: '', unit: '', inputs: [{ reading: first, label: '' }], expr: '' }; drawEd(); return false; });
  U.on('dy:in-add', () => { readEd(); if (!ED) return false; ED.inputs.push({ reading: ED.inputs[ED.inputs.length - 1].reading, label: '' }); drawEd(); return false; });
  U.on('dy:in-del', (el) => { readEd(); if (!ED) return false; ED.inputs.splice(+el.getAttribute('data-i'), 1); drawEd(); return false; });
  U.on('dy:lib-save', () => { readEd(); if (!ED) return false; const r = saveDef(ED.code, ED); if (!r.ok) { U.toast(r.error); return false; } ED = null; U.closeModal(true); U.toast('Saved. Plants are offered it as an optional step.'); return undefined; });
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
  function plantCard(key) {
    const all = offers(key); if (!all.length) return ''; const on = all.filter((o) => o.state === 'on').length; const groups = [];
    all.forEach((o) => { let g = groups.find((x) => x.id === o.subjId + '|' + (o.sk || '')); if (!g) groups.push(g = { id: o.subjId + '|' + (o.sk || ''), tag: o.tag, name: o.name, typeName: o.typeName, rows: [] }); g.rows.push(o); });
    const row = (o) => {
      const b = (state, label, kind) => btn(label, { act: 'dy:use', data: { plant: key, pid: o.pid, state }, small: true, kind });
      const acts = o.missing.length ? '' : o.state ? b('none', 'Undo', 'ghost') : b('on', 'Use it', 'primary') + b('off', 'Not now', 'ghost');
      const st = o.missing.length ? chip('Cannot be worked out here', { tone: 'warn' }) : o.state === 'on' ? chip('In use', { tone: 'ok' }) : o.state === 'off' ? chip('Not used', { tone: 'muted' }) : o.choose ? chip('Choose a sensor', { tone: 'warn' }) : chip('Optional', { tone: 'info' });
      const picks = o.missing.length ? '' : o.inputs.map((q, i) => (q.found.length > 1 ? `<label class="ua-pick${q.choose ? ' is-todo' : ''}"><span><b>${q.letter}</b> ${esc(q.label || q.reading)} from</span><select data-act="dy:pick" data-plant="${esc(key)}" data-pid="${esc(o.pid)}" data-i="${i}" aria-label="Which ${esc(q.reading)} sensor for ${q.letter}"><option value="">Choose the sensor…</option>${q.found.map((x) => `<option value="${esc(x.id)}"${q.pick === x.id ? ' selected' : ''}>${esc(x.tag)}${x.onPipe ? ' (pipe)' : ''}${x.eqTag ? ' · ' + esc(x.eqTag) : ''}</option>`).join('')}</select></label>` : '')).join('');
      const miss = o.missing.length ? `<div class="ua-miss">${esc(why(o).replace(/^./, (c) => c.toUpperCase()))} Add the sensor in the Visualization and read again.</div>` : '';
      const val = o.value != null ? `<span class="dy-now" title="Worked out on the latest readings">${esc(o.value)}${o.def.unit ? ' ' + esc(o.def.unit) : ''} now</span>` : '';
      return `<li class="ua-row${o.missing.length ? ' is-skip' : ''}"><div class="ua-main"><div class="ua-t"><b>${esc(o.def.name)}</b>${o.def.unit ? ` <span class="dy-u">in ${esc(o.def.unit)}</span>` : ''} ${st}</div><div class="ua-w dy-f">= ${esc(words(o.def, o))} ${val}</div>${picks ? `<div class="ua-picks">${picks}</div>` : ''}${miss}</div><div class="ua-acts">${acts}</div></li>`;
    };
    return fold('dy-plant', 'Calculated values', `Optional. Numbers worked out on the fly from this plant's readings: ${plural(all.length, 'offered', 'offered')} by the library, ${on} in use. They open no issue and no task.`,
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
