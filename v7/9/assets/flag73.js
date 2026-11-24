/* v7/3 · flag73.js — one visible flag for anything incomplete, with what is missing. An item is incomplete when a person still
   has to finish it before it works as set up: an alert with no limits or no diagnostic flow, a task with no steps, a flow with
   a question nothing reaches or a root cause with no fix flow (an answer that ends the flow is fine), equipment not placed in the structure, a structure not confirmed,
   library items nobody has decided. The same test feeds the flag on the item, the mark on its tab and the count in the top bar.
   window.V7FLAG73 = { chip(reasons, {small}) · flow(f) · alert(key, al) · task(key, t) · equipment(key, eqId) · tabFlags(key)
   · flowsCount() } — every reasons list is plain sentences; an empty list means complete. */
(function () {
  'use strict';
  const W = window; const UI = W.V7UI; if (!UI) return;
  const V = () => W.V7; const { esc, plural } = UI;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, fb) => { try { const v = fn(); return v == null ? fb : v; } catch (e) { return fb; } };
  const lib = () => (W.CTL && W.CTL.S && W.CTL.S.lib) || { flows: (W.SEED || {}).flows || [], causes: (W.SEED || {}).causes || [] };
  const BANDS = ['caution', 'minor', 'major', 'emergency'];

  function chip(reasons, o) {
    const rs = arr(reasons).filter(Boolean); if (!rs.length) return '';
    const more = rs.length > 1 ? ` (+${rs.length - 1})` : '';
    return `<span class="inc${o && o.small ? ' inc-sm' : ''}" title="${esc(rs.join('\n'))}"><span class="inc-i" aria-hidden="true">!</span>Incomplete${o && o.small ? '' : `<span class="inc-w">: ${esc(rs[0])}${more}</span>`}</span>`;
  }
  function flow(f) {
    if (!f) return ['The flow is not in the library.'];
    const out = W.V7FLOWS && W.V7FLOWS.problems ? arr(W.V7FLOWS.problems(f)).slice() : [];
    if (f.kind === 'diagnostic') {
      const ids = [...new Set(arr(f.steps).flatMap((s) => Object.values(s.answers || {}).filter((a) => a && a.t === 'cause').map((a) => a.id)))];
      ids.forEach((id) => { const c = arr(lib().causes).find((x) => x.id === id); if (c && !c.fix) out.push(`The root cause "${c.name}" has no fix flow.`); });
    }
    return out;
  }
  const flowById = (id) => arr(lib().flows).find((f) => f.id === id) || null;
  function alert(key, al) {
    if (!al) return []; const out = [];
    const set = BANDS.filter((b) => al.bands && al.bands[b] != null);
    if (!set.length && !al.nextPhase) out.push('No limits yet, so it never fires.');
    const tasks = new Set(arr(safe(() => V().lineWork(key, { sensorId: al.sensorId, dir: al.dir }), [])).map((w) => w.band));
    if (set.some((b) => !tasks.has(b))) {
      if (!al.flowId) out.push('No diagnostic flow, so people are not led to a root cause.');
      else { const n = flow(flowById(al.flowId)).length; if (n) out.push(`Its diagnostic flow has ${plural(n, 'thing')} to finish.`); }
    }
    return out;
  }
  function task(key, t) {
    if (!t) return []; const out = [];
    if (!arr(t.steps).length) out.push('No steps yet, so nobody is told how to do it.');
    else if (t.flowId) { const n = flow(flowById(t.flowId)).length; if (n) out.push(`Its steps have ${plural(n, 'thing')} to finish.`); }
    return out;
  }
  function equipment(key, eqId) {
    const out = []; const STR = W.V7STRUCT73;
    if (STR && arr(STR.unplaced(key)).includes(eqId)) out.push('Not placed in a unit process yet.');
    const al = arr(safe(() => V().alerts(key, { eqId }), [])).filter((a) => alert(key, a).length).length; if (al) out.push(`${plural(al, 'alert')} incomplete.`);
    const ts = arr(safe(() => V().tasks(key, { eqId }), [])).filter((t) => task(key, t).length).length; if (ts) out.push(`${plural(ts, 'task')} incomplete.`);
    return out;
  }
  /* what each plant tab still has to finish: {tabId: sentence} */
  function tabFlags(key) {
    const out = {}; const STR = W.V7STRUCT73; const st = safe(() => V().structure(key), null);
    if (STR && st && arr(st.ups).length) { const left = arr(STR.unplaced(key)).length; const bits = []; if (!STR.confirmed(key)) bits.push('the structure is not confirmed'); if (left) bits.push(`${plural(left, 'piece')} of equipment not placed`); if (bits.length) out.structure = bits.join('; '); }
    const und = arr(safe(() => V().libraryReview(key), [])).reduce((n, r) => n + arr(r.proposals).filter((p) => !p.decided && !p.blockedBy).length, 0); if (und) out.library = `${und} library ${und === 1 ? 'item' : 'items'} waiting for a decision`;
    const ts = arr(safe(() => V().tasks(key), [])).filter((t) => task(key, t).length).length; if (ts) out.tasks = `${plural(ts, 'task')} incomplete`;
    const eqs = arr(safe(() => V().equipment(key), [])).filter((e) => equipment(key, e.id).length).length; if (eqs) out.equipment = `${plural(eqs, 'piece')} of equipment with something incomplete`;
    return out;
  }
  let FC = null;   // {sig, n}
  function flowsCount() { const fs = arr(lib().flows); const sig = fs.length + ':' + fs.reduce((n, f) => n + (f.version || 0), 0); if (!FC || FC.sig !== sig) FC = { sig, n: fs.filter((f) => flow(f).length).length }; return FC.n; }

  W.V7FLAG73 = { chip, flow, alert, task, equipment, tabFlags, flowsCount };
}());
