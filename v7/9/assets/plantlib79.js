/* v7/9 · plantlib79.js — the plant library: what every plant carries, whatever its type.
   27 Nov. There are three libraries now: equipment types, unit-process types, and this one. It is generic: one set for all plants.
     - the tasks every plant carries (rounds and plant-wide maintenance)
     - alerts across the plant, and the calculated values they may read (kept by upalert78.js and dyn78.js under '@plant')
     - alerts for every control group ('@group')
   A plant type (a sewage, an effluent or a water plant) may add tasks of its own on top; those are listed apart.
   Every plant is offered all of it under "The plant itself" and accepts or leaves out each line.
   window.V7PLANTLIB = { tasks() → the generic tasks, extras() → [{ type, tasks }], ensure() } */
(function () {
  'use strict';
  const W = window; const arr = (x) => (Array.isArray(x) ? x : []);
  const PROF = () => W.PLANT_PROFILES || {};
  /* the generic set, by name. Each is taken from the first plant type that already carries it, so its interval and flow stay as written */
  const GENERIC = ['Daily logbook round', 'Monthly compliance sample', 'Hooter function test', 'Weekly housekeeping round',
    'Preventive maintenance - MCC / electrical panel maintenance', 'Preventive maintenance - Structural and corrosion inspection'];
  const MOVED = /Calibration of flow meter, level sensors and pressure gauges/i;   /* offered on the unit process that holds the instruments */
  const find = (name) => { for (const k of Object.keys(PROF())) { const r = arr(PROF()[k].rounds).find((x) => x.name === name); if (r) return r; } return null; };
  /* every plant type carries the generic set: a type that lacked one gets a copy */
  function ensure() {
    let n = 0; Object.keys(PROF()).forEach((k) => { const p = PROF()[k]; p.rounds = arr(p.rounds); GENERIC.forEach((name) => { if (p.rounds.some((x) => x.name === name)) return; const src = find(name); if (src) { p.rounds.push(JSON.parse(JSON.stringify(src))); n++; } }); });
    return n;
  }
  const added = ensure();
  const tasks = () => GENERIC.map(find).filter(Boolean);
  const extras = () => Object.keys(PROF()).map((k) => ({ type: k, tasks: arr(PROF()[k].rounds).filter((r) => !GENERIC.includes(r.name) && !MOVED.test(r.name)) })).filter((x) => x.tasks.length);
  W.V7PLANTLIB = { tasks, extras, ensure, added, names: GENERIC.slice() };

  /* ── on the Library page, the third tab ─────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const C = () => W.CTL;
  const flowOf = (id) => (id ? arr(C() && C().S && C().S.lib ? C().S.lib.flows : []).find((f) => f.id === id) || null : null);
  const WT = () => (C() && C().WT_LABEL) || {};
  const every = (r) => { try { return W.V7.everyText(r.every); } catch (e) { return `every ${r.every.n} ${r.every.unit}`; } };
  const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const TYPE = { STP: 'Sewage treatment plants', ETP: 'Effluent treatment plants', WTP: 'Water treatment plants' };
  function row(r) {
    const f = flowOf(r.flow);
    return `<tr><td data-label="Task"><b>${esc(r.name)}</b><div class="muted small">${esc(WT()[r.workType] || 'Task')}${r.statutory ? ' · statutory' : ''}</div></td><td data-label="How often">${esc(cap(every(r)))}</td><td data-label="Flow">${f ? `<span class="lf"><button type="button" class="lf-n lf-view" data-act="lf:view" data-id="${esc(f.id)}" title="See its steps here">${esc(f.name)}</button><span class="lf-c">${arr(f.steps).length} steps</span></span>` : '<span class="muted">No flow yet</span>'}</td></tr>`;
  }
  const table = (rows) => `<div class="tbl-wrap"><table class="tbl pl-tbl"><thead><tr><th>Task</th><th>How often</th><th>Flow</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>`;
  function html() {
    const UA = W.V7UPALERT; const DY = W.V7DYN; const ts = tasks(); const ex = extras();
    const box = (code) => (UA && UA.libBox ? UA.libBox({ code }, { solo: true }) : '') + (DY && DY.libBox ? DY.libBox(code) : '');
    return `<section class="card pl-lib-c"><header class="card-h"><div class="card-hl"><h2 class="card-t">What every plant carries</h2><p class="card-s">One library for all plants, whatever they treat. Each plant is offered every line under "The plant itself" and accepts it or leaves it out. This is a first draft to confirm.</p></div></header><div class="card-b">`
      + `<h3 class="pl-h">Tasks for the plant as a whole <span>${ts.length}</span></h3><p class="pl-s">Rounds and plant-wide maintenance that belong to no single unit process or piece of equipment.</p>${table(ts)}`
      + `<h3 class="pl-h">Across the plant</h3><p class="pl-s">Alerts that read sensors anywhere at the plant, and the calculated values they may watch. A plant-level value can read any sensor installed at the plant.</p>${box('@plant')}`
      + `<h3 class="pl-h">Every control group</h3><p class="pl-s">For equipment that works as a set, such as duty and standby. Each control group at a plant is offered these and reads only its own members.</p>${box('@group')}`
      + (ex.length ? `<h3 class="pl-h">On top, by kind of plant</h3><p class="pl-s">Tasks only one kind of plant needs. Everything else here is the same for all plants.</p>${ex.map((x) => `<h4 class="pl-h4">${esc(TYPE[x.type] || x.type)}</h4>${table(x.tasks)}`).join('')}` : '')
      + '</div></section>';
  }
  if (U.afterRender) U.afterRender((main) => { try { const slot = main && main.querySelector('#pl-lib'); if (slot && !slot.firstChild) slot.innerHTML = html(); } catch (e) { /* the tab shows empty */ } });
})();
