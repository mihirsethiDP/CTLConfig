/* v7/8 · libtrig78.js — what a range triggers is set on the library type, and plants follow it.
   A range of a reading either opens an issue (the default) or raises a task. Until now that choice lived only on a plant's own
   reading, so every plant made it by hand. Now the type says it once:
     "Blower · Motor current, rises above · Caution raises the task Clean the intake filter"
   and every plant reading of that type that has the same line follows it, the way it follows the limits. A plant can still choose
   its own (another task, or an issue after all); that reading then stops following for that range until it is sent back.

   window.V7LIBTRIG:
     get(code, reading, dir)                         → {band: {name, flowId}} for the type
     set(code, reading, dir, band, {name, flowId}|null)  null = the range opens an issue again
     preview(code, reading, dir, band)               → {follow:[{plant, tag}], own:[{plant, tag}], noLine:[{plant, tag}]}
     libFor(key, sensorId, dir, band)                → the type's trigger for a plant's reading, or null
     source(key, sensorId, dir, band)                → 'lib' (follows) | 'own' | null (the type says nothing)
     backToLib(key, sensorId, dir, band) · sync() → true when a plant changed
   A trigger has no draft: it applies when it is saved, and the sheet says which plants it reaches first. Kept in the saved state
   (V7.S.lib.triggers; a plant's own choices in plant.lineOwn) and put back on every boot and reset. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7;
  const BANDS = ['caution', 'minor', 'major', 'emergency']; const BAND_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, d) => { try { const r = fn(); return r == null ? d : r; } catch (e) { return d; } };
  const store = () => { const L = V().S.lib; if (!L.triggers || typeof L.triggers !== 'object') L.triggers = {}; return L.triggers; };
  const PS = (key) => V().S.plants[key] || null;
  const own = (key) => { const P = PS(key); if (!P) return {}; if (!P.lineOwn) P.lineOwn = {}; return P.lineOwn; };
  const k3 = (sensorId, dir, band) => `${sensorId}|${dir}|${band}`;
  const lwId = (sensorId, dir, band) => `lwl_${sensorId}_${dir}_${band}`.replace(/[^\w-]/g, '_');
  function get(code, reading, dir) { return { ...((store()[code] || {})[`${reading}|${dir}`] || {}) }; }
  /* each plant reading with its type's code */
  function readingsOf(key) {
    const v = V(); const eqs = {}; arr(safe(() => v.equipment(key), [])).forEach((e) => { eqs[e.id] = e; });
    return arr(safe(() => v.sensors(key), [])).filter((s) => !s.nextPhase && s.eqId && eqs[s.eqId]).map((s) => ({ s, e: eqs[s.eqId], code: eqs[s.eqId].code || eqs[s.eqId].dbType }));
  }
  function libFor(key, sensorId, dir, band) {
    const r = readingsOf(key).find((x) => x.s.id === sensorId); if (!r) return null;
    const t = get(r.code, r.s.name, dir)[band]; return t || null;
  }
  function source(key, sensorId, dir, band) { if (!libFor(key, sensorId, dir, band)) return null; return own(key)[k3(sensorId, dir, band)] ? 'own' : 'lib'; }
  const hasLine = (key, sensorId, dir, band) => { const l = safe(() => V().limitsOf(key, sensorId, dir), null); return !!(l && l.bands && l.bands[band] != null); };
  /* bring one plant in line with the library: add, rename or remove the tasks that follow it. A plant's own choice is left alone. */
  function syncPlant(key) {
    const P = PS(key); if (!P) return false; if (!Array.isArray(P.lineWork)) P.lineWork = []; const O = own(key); let changed = false; const want = new Map();
    readingsOf(key).forEach(({ s, code }) => { const T = store()[code] || {}; Object.keys(T).forEach((rk) => { const i = rk.lastIndexOf('|'); const reading = rk.slice(0, i); const dir = rk.slice(i + 1); if (reading !== s.name) return;
      BANDS.forEach((b) => { const t = T[rk][b]; if (!t || O[k3(s.id, dir, b)] || !hasLine(key, s.id, dir, b)) return; want.set(k3(s.id, dir, b), { sensorId: s.id, dir, band: b, name: t.name, flowId: t.flowId || null }); }); }); });
    /* drop the ones that no longer follow anything */
    P.lineWork = P.lineWork.filter((lw) => { if (!lw.fromLib || want.has(k3(lw.sensorId, lw.dir, lw.band))) return true; const st = P.tasks && P.tasks[lw.id]; if (st && st.status !== 'doing') delete P.tasks[lw.id]; changed = true; return false; });
    want.forEach((w, k) => {
      const cur = P.lineWork.find((lw) => k3(lw.sensorId, lw.dir, lw.band) === k);
      if (cur && !cur.fromLib) return;   /* a task set at the plant before the library said anything: the plant's own */
      if (cur) { if (cur.name !== w.name || (cur.flowId || null) !== w.flowId) { cur.name = w.name; cur.flowId = w.flowId; changed = true; } return; }
      const lw = { id: lwId(w.sensorId, w.dir, w.band), name: w.name, sensorId: w.sensorId, dir: w.dir, band: w.band, filedAt: null, flowId: w.flowId, why: 'From the library', at: V().now(), by: 'Library', fromLib: true };
      P.lineWork.push(lw); if (P.state === 'live' && P.tasks && !P.tasks[lw.id]) P.tasks[lw.id] = { due: null, lastDone: null, status: 'armed', done: [], history: [], startedAt: null };
      changed = true;
    });
    return changed;
  }
  function sync() { const v = V(); let any = false; arr(safe(() => v.plants(), [])).forEach((p) => { if (syncPlant(p.key)) any = true; }); if (any && v.touch) v.touch(); return any; }
  function preview(code, reading, dir, band) {
    const v = V(); const out = { follow: [], own: [], noLine: [] };
    arr(safe(() => v.plants(), [])).forEach((p) => readingsOf(p.key).filter((x) => x.code === code && x.s.name === reading && arr(x.s.dirs).includes(dir)).forEach((x) => {
      const row = { plant: p.name, key: p.key, tag: x.e.tag }; const P = PS(p.key); const cur = arr(P.lineWork).find((lw) => lw.sensorId === x.s.id && lw.dir === dir && lw.band === band);
      if (!hasLine(p.key, x.s.id, dir, band)) out.noLine.push(row); else if (own(p.key)[k3(x.s.id, dir, band)] || (cur && !cur.fromLib)) out.own.push(row); else out.follow.push(row);
    }));
    return out;
  }
  function set(code, reading, dir, band, t) {
    const v = V(); const lt = safe(() => v.libType(code), null); if (!lt) return { ok: false, error: 'No such type.' }; if (!BANDS.includes(band)) return { ok: false, error: 'Pick a range.' };
    if (band === 'emergency' && t) return { ok: false, error: 'Emergency always opens an issue.' };
    const S = store(); const rk = `${reading}|${dir}`; const was = ((S[code] || {})[rk] || {})[band] || null;
    if (!t) { if (!was) return { ok: true, changed: false }; delete S[code][rk][band]; if (!Object.keys(S[code][rk]).length) delete S[code][rk]; if (!Object.keys(S[code]).length) delete S[code]; }
    else {
      const name = String(t.name || '').trim(); if (!name) return { ok: false, error: `Name the task the ${BAND_LABEL[band]} range raises.` };
      if (was && was.name === name && (was.flowId || null) === (t.flowId || null)) return { ok: true, changed: false };
      S[code] = S[code] || {}; S[code][rk] = S[code][rk] || {}; S[code][rk][band] = { name, flowId: t.flowId || null };
    }
    const pv = preview(code, reading, dir, band); sync();
    const plants = [...new Set(pv.follow.map((x) => x.plant))];
    v.log(null, `${lt.typeName}: the ${BAND_LABEL[band]} range of ${reading} (${dir === 'below' ? 'falls below' : 'rises above'}) ${t ? `now raises the task "${String(t.name).trim()}"` : 'opens an issue again'}. ${pv.follow.length ? `Reaches ${pv.follow.length} ${pv.follow.length === 1 ? 'reading' : 'readings'} at ${plants.join(', ')}` : 'No plant reading follows it yet'}${pv.own.length ? `; ${pv.own.length} ${pv.own.length === 1 ? 'keeps its' : 'keep their'} own` : ''}`, 'library');
    plants.forEach((pn) => { const key = pv.follow.find((x) => x.plant === pn).key; v.log(key, `Library: ${lt.typeName}, the ${BAND_LABEL[band]} range of ${reading} ${t ? `now raises the task "${String(t.name).trim()}" instead of an issue` : 'opens an issue again'} on ${pv.follow.filter((x) => x.plant === pn).map((x) => x.tag).join(', ')}`, 'library'); });
    v.touch(); v.persist(); return { ok: true, changed: true, reached: pv.follow.length, kept: pv.own.length };
  }
  function backToLib(key, sensorId, dir, band) {
    const P = PS(key); if (!P || !libFor(key, sensorId, dir, band)) return { ok: false, error: 'The library says nothing for this range.' };
    delete own(key)[k3(sensorId, dir, band)]; const i = arr(P.lineWork).findIndex((lw) => lw.sensorId === sensorId && lw.dir === dir && lw.band === band && !lw.fromLib);
    if (i >= 0) { const was = P.lineWork[i]; P.lineWork.splice(i, 1); const st = P.tasks && P.tasks[was.id]; if (st && st.status !== 'doing') delete P.tasks[was.id]; }
    syncPlant(key); const v = V(); v.touch(); v.log(key, `The ${BAND_LABEL[band]} range follows the library again: it raises "${libFor(key, sensorId, dir, band).name}"`, 'config'); v.persist(); return { ok: true };
  }
  W.V7LIBTRIG = { get, set, preview, libFor, source, backToLib, sync };

  /* a choice made at a plant is the plant's own from then on; and the library is put back whenever the state is loaded */
  (function hook() {
    const v = V(); if (!v) return;
    const s0 = v.setLineWork; if (typeof s0 === 'function') v.setLineWork = function (key, sensorId, dir, band, opts) {
      const P = PS(key); const cur = P && arr(P.lineWork).find((lw) => lw.sensorId === sensorId && lw.dir === dir && lw.band === band); const lib = libFor(key, sensorId, dir, band);
      const name = opts && opts.name != null ? String(opts.name).trim() : '';
      if (cur && cur.fromLib) {
        if (name && name === cur.name && ((opts && opts.flowId !== undefined ? opts.flowId || null : cur.flowId || null) === (cur.flowId || null))) return { ok: true, changed: false };
        cur.fromLib = false;   /* from here on it is edited as the plant's own */
      }
      const r = s0.apply(this, arguments);
      if (r && r.ok && lib) { own(key)[k3(sensorId, dir, band)] = name ? 'task' : 'issue'; v.touch(); v.persist(); }
      return r;
    };
    ['boot', 'reset'].forEach((fn) => { const f0 = v[fn]; if (typeof f0 !== 'function') return; v[fn] = function () { const r = f0.apply(this, arguments); try { sync(); } catch (e) { /* plants stay as they were */ } return r; }; });
  })();
  /* a line added or removed at a plant, or a plant just set up: follow on the next screen */
  const U = W.V7UI; if (U && U.afterRender) { let busy = false; U.afterRender(() => { if (busy) return; busy = true; try { if (sync()) { V().persist(); } } catch (e) { /* ignore */ } busy = false; }); }
  if (U && U.on) U.on('obj:ltrigback', (el) => { const r = backToLib(el.getAttribute('data-plant'), el.getAttribute('data-sensor'), el.getAttribute('data-dir'), el.getAttribute('data-band')); if (U.closeSheet) U.closeSheet(); U.toast(r.ok ? 'This range follows the library again.' : r.error); return undefined; });
})();
