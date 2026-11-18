/* v7/8 · libtrig78.js — what a range triggers is set on the library type, and plants follow it.
   A range of a reading either opens an issue (the default) or raises a task. The type says which:
     "Blower · Motor current, rises above · Caution raises the task Clean the intake filter"
   and every plant reading of that type that has the same line follows it, the way it follows the limits.
   - It goes through the draft like a limit: saved to the type's draft (V7.editLib(code, {trigger})), shown in Where it lands, and it
     reaches plants only when the draft is published.
   - A plant can choose its own (another task, or an issue after all). That is a deviation: it asks why, it is listed under
     Deviations, and "Back to the library value" there sends it back. A task a plant had before the library said anything is kept
     and listed as a deviation whose reason was not recorded.

   window.V7LIBTRIG:
     get(code, reading, dir, {draft})          → {band: {name, flowId, draft?}}; with draft, what the type would say once published
     preview(code, reading, dir, band)         → {follow:[{plant, key, tag}], own:[…], noLine:[…]}
     libFor(key, sensorId, dir, band)          → the published trigger for a plant's reading, or null
     source(key, sensorId, dir, band)          → 'lib' (follows) | 'own' | null (the type says nothing)
     backToLib(key, sensorId, dir, band, {quiet}) · sync() → true when a plant changed
     commit(code, reading, dir, band, t|null) · adopt(code)     used by publish
     set(code, reading, dir, band, t|null)     commit, adopt and sync in one step, with no draft (for tests and seeding)
   Kept in the saved state (V7.S.lib.triggers; a plant's own choices in plant.lineOwn) and put back on every boot and reset. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7;
  const BANDS = ['caution', 'minor', 'major', 'emergency']; const BAND_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const ISSUE = 'issue';   /* a plant's own choice of "an issue after all", as a deviation's value */
  const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, d) => { try { const r = fn(); return r == null ? d : r; } catch (e) { return d; } };
  const store = () => { const L = V().S.lib; if (!L.triggers || typeof L.triggers !== 'object') L.triggers = {}; return L.triggers; };
  const PS = (key) => V().S.plants[key] || null;
  const own = (key) => { const P = PS(key); if (!P) return {}; if (!P.lineOwn) P.lineOwn = {}; return P.lineOwn; };
  const k3 = (sensorId, dir, band) => `${sensorId}|${dir}|${band}`;
  const lwId = (sensorId, dir, band) => `lwl_${sensorId}_${dir}_${band}`.replace(/[^\w-]/g, '_');
  function get(code, reading, dir, opts) {
    const out = {}; const pub = (store()[code] || {})[`${reading}|${dir}`] || {}; Object.keys(pub).forEach((b) => { out[b] = { ...pub[b] }; });
    if (opts && opts.draft) { const dr = (V().S.lib.drafts || {})[code]; const d = dr && dr.triggers && dr.triggers[`${reading}|${dir}`]; if (d) Object.keys(d).forEach((b) => { if (d[b]) out[b] = { ...d[b], draft: true }; else delete out[b]; }); }
    return out;
  }
  /* each plant reading with its type's code */
  function readingsOf(key) {
    const v = V(); const eqs = {}; arr(safe(() => v.equipment(key), [])).forEach((e) => { eqs[e.id] = e; });
    return arr(safe(() => v.sensors(key), [])).filter((s) => !s.nextPhase && s.eqId && eqs[s.eqId]).map((s) => ({ s, e: eqs[s.eqId], code: eqs[s.eqId].code || eqs[s.eqId].dbType }));
  }
  function libFor(key, sensorId, dir, band) { const r = readingsOf(key).find((x) => x.s.id === sensorId); if (!r) return null; return get(r.code, r.s.name, dir)[band] || null; }
  const ownTask = (key, sensorId, dir, band) => arr((PS(key) || {}).lineWork).find((lw) => lw.sensorId === sensorId && lw.dir === dir && lw.band === band && !lw.fromLib) || null;
  function source(key, sensorId, dir, band) { if (!libFor(key, sensorId, dir, band)) return null; return own(key)[k3(sensorId, dir, band)] || ownTask(key, sensorId, dir, band) ? 'own' : 'lib'; }
  const hasLine = (key, sensorId, dir, band) => { const l = safe(() => V().limitsOf(key, sensorId, dir), null); return !!(l && l.bands && l.bands[band] != null); };
  /* the deviation that records a plant's own choice for one range */
  const ovOf = (key, sensorId, dir, band) => arr(V().S.overrides).find((o) => o.plant === key && !o.endedAt && o.target && o.target.kind === 'trigger' && o.target.sensorId === sensorId && o.target.dir === dir && o.target.band === band) || null;
  function record(key, sensorId, dir, band, value, base, opts) {
    const X = V()._ov; if (!X) return; const cur = ovOf(key, sensorId, dir, band); if (cur) { if (cur.value === value) return; X.end(cur, 'Changed again'); }
    X.add(key, { kind: 'trigger', sensorId, dir, band }, value, base, opts);
  }
  /* bring one plant in line with the library: add, rename or remove the tasks that follow it. A plant's own choice is left alone. */
  function syncPlant(key) {
    const P = PS(key); if (!P) return false; if (!Array.isArray(P.lineWork)) P.lineWork = []; const O = own(key); let changed = false; const want = new Map(); const X = V()._ov;
    readingsOf(key).forEach(({ s, code }) => { const T = store()[code] || {}; Object.keys(T).forEach((rk) => { const i = rk.lastIndexOf('|'); const reading = rk.slice(0, i); const dir = rk.slice(i + 1); if (reading !== s.name) return;
      BANDS.forEach((b) => { const t = T[rk][b]; if (!t || O[k3(s.id, dir, b)] || !hasLine(key, s.id, dir, b)) return; want.set(k3(s.id, dir, b), { sensorId: s.id, dir, band: b, name: t.name, flowId: t.flowId || null }); }); }); });
    P.lineWork = P.lineWork.filter((lw) => { if (!lw.fromLib || want.has(k3(lw.sensorId, lw.dir, lw.band))) return true; const st = P.tasks && P.tasks[lw.id]; if (st && st.status !== 'doing') delete P.tasks[lw.id]; changed = true; return false; });
    want.forEach((w, k) => {
      const cur = P.lineWork.find((lw) => k3(lw.sensorId, lw.dir, lw.band) === k);
      if (cur && !cur.fromLib) return;   /* a task set at the plant: the plant's own */
      if (cur) { if (cur.name !== w.name || (cur.flowId || null) !== w.flowId) { cur.name = w.name; cur.flowId = w.flowId; changed = true; } return; }
      const lw = { id: lwId(w.sensorId, w.dir, w.band), name: w.name, sensorId: w.sensorId, dir: w.dir, band: w.band, filedAt: null, flowId: w.flowId, why: 'From the library', at: V().now(), by: 'Library', fromLib: true };
      P.lineWork.push(lw); if (P.state === 'live' && P.tasks && !P.tasks[lw.id]) P.tasks[lw.id] = { due: null, lastDone: null, status: 'armed', done: [], history: [], startedAt: null };
      changed = true;
    });
    /* the library no longer says anything for a range a plant had its own choice on: nothing differs any more */
    arr(V().S.overrides).filter((o) => o.plant === key && !o.endedAt && o.target && o.target.kind === 'trigger' && !libFor(key, o.target.sensorId, o.target.dir, o.target.band)).forEach((o) => { if (X) X.end(o, 'The library no longer sets what this range triggers'); delete O[k3(o.target.sensorId, o.target.dir, o.target.band)]; changed = true; });
    return changed;
  }
  function sync() { const v = V(); let any = false; arr(safe(() => v.plants(), [])).forEach((p) => { if (syncPlant(p.key)) any = true; }); if (any && v.touch) v.touch(); return any; }
  function preview(code, reading, dir, band) {
    const v = V(); const out = { follow: [], own: [], noLine: [] };
    arr(safe(() => v.plants(), [])).forEach((p) => readingsOf(p.key).filter((x) => x.code === code && x.s.name === reading && arr(x.s.dirs).includes(dir)).forEach((x) => {
      const cur = ownTask(p.key, x.s.id, dir, band); const mine = own(p.key)[k3(x.s.id, dir, band)];
      const row = { plant: p.name, key: p.key, tag: x.e.tag, sensorId: x.s.id, ownValue: cur ? cur.name : mine === ISSUE ? ISSUE : null };
      if (!hasLine(p.key, x.s.id, dir, band)) out.noLine.push(row); else if (mine || cur) out.own.push(row); else out.follow.push(row);
    }));
    return out;
  }
  function commit(code, reading, dir, band, t) {
    const S = store(); const rk = `${reading}|${dir}`;
    if (!t) { if (S[code] && S[code][rk]) { delete S[code][rk][band]; if (!Object.keys(S[code][rk]).length) delete S[code][rk]; if (!Object.keys(S[code]).length) delete S[code]; } return; }
    S[code] = S[code] || {}; S[code][rk] = S[code][rk] || {}; S[code][rk][band] = { name: String(t.name).trim(), flowId: t.flowId || null };
  }
  /* a task a plant already had on a range the library now speaks for is its own value, with no reason on record */
  function adopt(code) {
    const v = V(); const T = store()[code] || {};
    arr(safe(() => v.plants(), [])).forEach((p) => readingsOf(p.key).filter((x) => x.code === code).forEach((x) => Object.keys(T).forEach((rk) => { const i = rk.lastIndexOf('|'); if (rk.slice(0, i) !== x.s.name) return; const dir = rk.slice(i + 1);
      BANDS.forEach((b) => { const t = T[rk][b]; const cur = t && ownTask(p.key, x.s.id, dir, b); if (!cur || ovOf(p.key, x.s.id, dir, b)) return; own(p.key)[k3(x.s.id, dir, b)] = 'task'; record(p.key, x.s.id, dir, b, cur.name, t.name, { reason: 'unrecorded', note: '', reviewBy: null, author: null }); }); })));
  }
  function set(code, reading, dir, band, t) {
    const v = V(); const lt = safe(() => v.libType(code), null); if (!lt) return { ok: false, error: 'No such type.' }; if (!BANDS.includes(band)) return { ok: false, error: 'Pick a range.' };
    if (band === 'emergency' && t) return { ok: false, error: 'Emergency always opens an issue.' };
    if (t && !String(t.name || '').trim()) return { ok: false, error: `Name the task the ${BAND_LABEL[band]} range raises.` };
    const was = get(code, reading, dir)[band] || null; if (!t && !was) return { ok: true, changed: false }; if (t && was && was.name === String(t.name).trim() && (was.flowId || null) === (t.flowId || null)) return { ok: true, changed: false };
    const pv = preview(code, reading, dir, band); commit(code, reading, dir, band, t); adopt(code); sync(); v.touch(); v.persist();
    return { ok: true, changed: true, reached: pv.follow.length, kept: pv.own.length };
  }
  function backToLib(key, sensorId, dir, band, opts) {
    const P = PS(key); const lib = libFor(key, sensorId, dir, band); if (!P || !lib) return { ok: false, error: 'The library says nothing for this range.' };
    delete own(key)[k3(sensorId, dir, band)]; const i = arr(P.lineWork).findIndex((lw) => lw.sensorId === sensorId && lw.dir === dir && lw.band === band && !lw.fromLib);
    if (i >= 0) { const was = P.lineWork[i]; P.lineWork.splice(i, 1); const st = P.tasks && P.tasks[was.id]; if (st && st.status !== 'doing') delete P.tasks[was.id]; }
    const o = ovOf(key, sensorId, dir, band); const X = V()._ov; if (o && X && !(opts && opts.keepOverride)) X.end(o, 'Back to the library value');
    syncPlant(key); const v = V(); v.touch(); if (!(opts && opts.quiet)) { v.log(key, `The ${BAND_LABEL[band]} range follows the library again: it raises "${lib.name}"`, 'config'); v.persist(); } return { ok: true };
  }
  W.V7LIBTRIG = { get, preview, libFor, source, backToLib, sync, commit, adopt, set, ISSUE };

  /* a choice made at a plant where the library says otherwise is the plant's own from then on, and a deviation */
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
      if (r && r.ok && lib) {
        if (name && name === lib.name) { delete own(key)[k3(sensorId, dir, band)]; const o = ovOf(key, sensorId, dir, band); if (o && v._ov) v._ov.end(o, 'Now the same as the library'); const mine = ownTask(key, sensorId, dir, band); if (mine) mine.fromLib = true; }
        else { own(key)[k3(sensorId, dir, band)] = name ? 'task' : ISSUE; record(key, sensorId, dir, band, name || ISSUE, lib.name, { reason: (opts && opts.reason) || 'tuned', note: (opts && opts.note) || '', until: opts && opts.until }); }
        v.touch(); v.persist();
      }
      return r;
    };
    ['boot', 'reset'].forEach((fn) => { const f0 = v[fn]; if (typeof f0 !== 'function') return; v[fn] = function () { const r = f0.apply(this, arguments); try { sync(); } catch (e) { /* plants stay as they were */ } return r; }; });
  })();
  /* a line added or removed at a plant, or a plant just set up: follow on the next screen */
  const U = W.V7UI; if (U && U.afterRender) { let busy = false; U.afterRender(() => { if (busy) return; busy = true; try { if (sync()) { V().persist(); } } catch (e) { /* ignore */ } busy = false; }); }
  if (U && U.on) U.on('obj:ltrigback', (el) => { const r = backToLib(el.getAttribute('data-plant'), el.getAttribute('data-sensor'), el.getAttribute('data-dir'), el.getAttribute('data-band')); if (U.closeSheet) U.closeSheet(); U.toast(r.ok ? 'This range follows the library again.' : r.error); return undefined; });
})();
