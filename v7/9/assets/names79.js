/* v7/9 · names79.js — a task takes the name its flow carries.
   28 Nov (decided). Until now a library task could be called one thing and follow a flow called another: 89 of them did.
     - Where one task of a type follows a flow, the task takes the flow's name (64 tasks).
     - Where several tasks of a type shared one flow (the same steps on two intervals, such as a check and a yearly replacement),
       each gets a flow of its own, copied from the shared one and named after the task (25 tasks). The task keeps its name.
   After this every library task that has a flow carries that flow's name, so a task and its steps cannot drift apart.
   It runs once, on the library as shipped, before any plant reads it. A task keeps its old name in `was`, for the record.
   window.V7NAMES = { renamed: [{ type, from, to }], split: [{ type, task, from, flow }], check() → tasks whose name still differs } */
(function () {
  'use strict';
  const W = window; const SEED = W.SEED; if (!SEED || !Array.isArray(SEED.standardSets) || !Array.isArray(SEED.flows)) { W.V7NAMES = { renamed: [], split: [], check: () => [] }; return; }
  const flows = SEED.flows; const sets = SEED.standardSets; const byId = (id) => flows.find((f) => f.id === id) || null;
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'own';
  const renamed = []; const split = [];
  sets.forEach((t) => {
    const by = {}; t.schedules.forEach((s) => { if (s.flow) (by[s.flow] = by[s.flow] || []).push(s); });
    t.schedules.forEach((s) => {
      const f = s.flow ? byId(s.flow) : null; if (!f || f.name === s.name) return;
      const shared = by[f.id].length > 1 || t.schedules.some((x) => x !== s && x.name === f.name);
      if (shared) {
        const tail = s.name.indexOf(f.name) === 0 ? s.name.slice(f.name.length) : s.name; const id = `${f.id}__${slug(tail)}`; let own = byId(id);
        if (!own) { own = JSON.parse(JSON.stringify(f)); own.id = id; own.name = s.name; own.forTypes = [t.type]; own.splitFrom = f.id; own.version = 1; delete own.task; flows.push(own); }
        else if (Array.isArray(own.forTypes) && !own.forTypes.includes(t.type)) own.forTypes.push(t.type);
        split.push({ type: t.type, task: s.name, from: f.id, flow: id }); s.flow = id;
      } else { renamed.push({ type: t.type, from: s.name, to: f.name }); s.was = s.name; s.name = f.name; }
    });
  });
  /* anything that names a task of a type by its old name follows it: the sample plant's own tasks, and words kept per name */
  const map = {}; const back = {}; renamed.forEach((r) => { (map[r.type] = map[r.type] || {})[r.from] = r.to; if (!back[r.to]) back[r.to] = r.from; });
  const typeOf = (id) => { const e = (SEED.equipment || []).find((x) => x.id === id); return e ? e.type : null; };
  ['schedules', 'conditionWork'].forEach((k) => (SEED[k] || []).forEach((x) => { const ty = x.subject && x.subject.id ? typeOf(x.subject.id) : null; const to = ty && map[ty] ? map[ty][x.name] : null; if (to) { x.was = x.name; x.name = to; } }));
  const check = () => { const out = []; sets.forEach((t) => t.schedules.forEach((s) => { const f = s.flow ? byId(s.flow) : null; if (f && f.name !== s.name) out.push({ type: t.type, task: s.name, flow: f.name }); })); return out; };
  W.V7NAMES = { renamed, split, nameFor: (type, name) => (map[type] && map[type][name]) || name, was: (name) => back[name] || null, check };
})();
