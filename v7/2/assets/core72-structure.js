/* core72-structure.js — window.V7, extended with the plant's structure (v7/2: Alex's model as drafted).
   Loads after core7.js and before the library, ledger and commissioning files. It adds:
   - unit-process types: 27 library types, each holding the content (readings, Triggers, Tasks, Issue types) a basin or reactor
     carries; at boot each one's content is copied from one database equipment type, so the plants carry what v7/1 gives them
     until a person changes a unit process's type;
   - identification: a pure function of the plant graph that proposes which nodes are unit processes and of which type, which
     equipment takes part in each (five rules), and which machines run together as a control group;
   - the structure pass: a person accepts, changes or rejects each proposal and places what no rule placed; decisions and hand
     edits sit beside the proposals, so re-running identification loses nothing; every action can be undone;
   - membership, many to many, with the consequence shown before saving; on a Live plant every edit needs a reason and flags the
     Triggers it touches;
   - subjects: a Trigger, Issue or Task is about a unit process, a piece of equipment or the plant; an Issue on equipment shows on
     every unit process it takes part in; diagnosis names the cause from the structure first;
   - criticality tier derived from the structure: a piece of equipment is as critical as the most critical unit process it takes
     part in, never less than its type says.
   Every number is computed from the plant graph and the stored decisions; nothing here draws from the shared id counter. */
(function () {
  'use strict';
  const V = window.V7;
  if (!V || !V.__) throw new Error('core72-structure.js needs core7.js loaded first');
  const __ = V.__, C = __.C;
  const S = () => __.S;
  const { MIN, DAY, ME } = __;

  /* ── the unit-process type library ───────────────────────────────────────────────────────── */
  /* anchors: the stored survey types that make a node this kind of unit process; contentFrom: the database type whose content it
     starts with; generic types (the five tanks the survey can't tell apart) are proposed from the node's place in the graph */
  const UP_TYPES = [
    { id: 'screening', name: 'Screening', stage: 'preliminary', anchors: ['OS_TANK_SC'], contentFrom: 'OS_TANK_SC', expected: ['Mechanical Screen', 'Rotary Drum'] },
    { id: 'grit', name: 'Grit removal', stage: 'preliminary', anchors: ['GRIT_CHAMBER'], contentFrom: 'GRIT_CHAMBER', expected: ['Grit Classifier', 'Hydro Cyclone', 'Pump'] },
    { id: 'oil-grease', name: 'Oil and grease removal', stage: 'preliminary', anchors: ['SH_TANK'], contentFrom: 'SH_TANK', expected: ['Pump'] },
    { id: 'sump', name: 'Collection sump', stage: 'preliminary', anchors: ['OS_TANK_SP'], contentFrom: 'OS_TANK', generic: true, expected: ['Submersible Pump', 'Pump'] },
    { id: 'equalisation', name: 'Equalisation', stage: 'preliminary', anchors: [], contentFrom: 'OS_TANK', generic: true, expected: ['Blower', 'Submersible Pump', 'Pump', 'Agitator', 'Dosing Tank', 'Dosing Pump', 'Two way Valve'] },
    { id: 'flash-mixing', name: 'Flash mixing', stage: 'primary', anchors: ['FLASH_MIXER'], contentFrom: 'FLASH_MIXER', expected: ['Agitator', 'Dosing Tank', 'Dosing Pump'] },
    { id: 'flocculation', name: 'Flocculation', stage: 'primary', anchors: ['FLOCCULATION'], contentFrom: 'FLOCCULATION', expected: ['Agitator', 'Dosing Tank', 'Dosing Pump'] },
    { id: 'daf', name: 'Dissolved air flotation', stage: 'primary', anchors: ['DAF'], contentFrom: 'DAF', expected: ['Pump', 'Air Compressor', 'Dosing Tank', 'Dosing Pump'] },
    { id: 'activated-sludge', name: 'Activated sludge', stage: 'secondary', anchors: ['OS_TANK_DF'], contentFrom: 'OS_TANK_DF', bio: true, expected: ['Blower', 'Mini Blower', 'Pump', 'Dosing Tank', 'Dosing Pump'] },
    { id: 'sbr', name: 'Sequencing batch reactor', stage: 'secondary', anchors: ['SBR_TANK'], contentFrom: 'SBR_TANK', bio: true, expected: ['Blower', 'Pump', 'Dosing Tank'] },
    { id: 'cass', name: 'Cyclic activated sludge', stage: 'secondary', anchors: ['CASS_BASIN'], contentFrom: 'CASS_BASIN', bio: true, expected: ['Blower', 'Pump'] },
    { id: 'mbbr', name: 'Moving bed bioreactor', stage: 'secondary', anchors: ['MBBR'], contentFrom: 'MBBR', bio: true, expected: ['Blower', 'Pump', 'Dosing Tank', 'Dosing Pump'] },
    { id: 'anaerobic', name: 'Anaerobic treatment', stage: 'secondary', anchors: ['ANAEROBIC_TANK'], contentFrom: 'ANAEROBIC_TANK', bio: true, expected: ['Pump', 'Agitator'] },
    { id: 'mbr', name: 'Membrane bioreactor', stage: 'secondary', anchors: ['MBR'], contentFrom: 'MBR', bio: true, filtration: true, expected: ['Blower', 'Pump', 'Two way Valve'] },
    { id: 'clarification', name: 'Secondary clarification', stage: 'secondary', anchors: ['CLARIFIER'], contentFrom: 'CLARIFIER', settling: true, expected: ['Pump'] },
    { id: 'tube-settling', name: 'Tube settling', stage: 'secondary', anchors: ['T_SETTLER'], contentFrom: 'T_SETTLER', settling: true, expected: ['Pump'] },
    { id: 'media-filtration', name: 'Media filtration', stage: 'tertiary', anchors: ['ACF_MGF'], contentFrom: 'ACF_MGF', filtration: true, expected: ['Pump', 'Two way Valve', 'Three way Valve'] },
    { id: 'cartridge', name: 'Cartridge filtration', stage: 'tertiary', anchors: ['CARTRIDGE_FILTER'], contentFrom: 'CARTRIDGE_FILTER', filtration: true, expected: ['Pump', 'Two way Valve'] },
    { id: 'uf', name: 'Ultrafiltration', stage: 'tertiary', anchors: ['UF_MEM'], contentFrom: 'UF_MEM', filtration: true, expected: ['Pump', 'Two way Valve', 'Dosing Tank', 'Dosing Pump'] },
    { id: 'ro', name: 'Reverse osmosis', stage: 'tertiary', anchors: ['RO'], contentFrom: 'RO', filtration: true, ro: true, expected: ['Booster Pump', 'Pump', 'Two way Valve', 'Dosing Tank', 'Dosing Pump'] },
    { id: 'softening', name: 'Softening', stage: 'tertiary', anchors: ['SOFTNER'], contentFrom: 'SOFTNER', expected: ['Two way Valve', 'Pump'] },
    { id: 'cascade', name: 'Cascade aeration', stage: 'tertiary', anchors: ['CASCADE_AREATOR'], contentFrom: 'CASCADE_AREATOR', expected: [] },
    { id: 'uv', name: 'UV disinfection', stage: 'tertiary', anchors: ['UV'], contentFrom: 'UV', expected: [] },
    { id: 'chlorine-contact', name: 'Chlorine contact', stage: 'tertiary', anchors: [], contentFrom: 'OS_TANK', generic: true, expected: ['Dosing Tank', 'Dosing Pump', 'Gas Tonner'] },
    { id: 'sludge-holding', name: 'Sludge holding', stage: 'sludge', anchors: [], contentFrom: 'OS_TANK', generic: true, expected: ['Pump', 'Agitator'] },
    { id: 'storage', name: 'Treated water storage', stage: null, anchors: ['OVERHEAD_T'], contentFrom: 'OS_TANK', generic: true, expected: ['Pump', 'Dosing Tank', 'Dosing Pump'] },
    { id: 'cooling', name: 'Cooling', stage: null, anchors: ['COOLING_TOWER'], contentFrom: 'COOLING_TOWER', expected: ['Pump'] },
  ].map((t) => ({ generic: false, bio: false, filtration: false, settling: false, ro: false, ...t }));
  const GENERIC_TANKS = ['OS_TANK', 'TANK', 'TANK_2', 'OP_TANK', 'CP_TANK'];
  const STAGES = [
    { key: 'preliminary', label: 'Preliminary' }, { key: 'primary', label: 'Primary' }, { key: 'secondary', label: 'Secondary' },
    { key: 'tertiary', label: 'Tertiary' }, { key: 'sludge', label: 'Sludge handling' }, { key: null, label: 'No stage' },
  ];
  const ROLE_LABEL = { blower: 'Blowers', recirc: 'Recirculation', filter: 'Permeate and backwash', pump: 'Pumps', dosing: 'Dosing', valve: 'Valves', other: 'Other' };
  const ROLE_ORDER = ['blower', 'recirc', 'filter', 'pump', 'dosing', 'valve', 'other'];
  __.LABELS.membership = { proposed: 'Proposed', confirmed: 'Confirmed', added: 'Added', removed: 'Removed', unclassified: 'Unclassified', underneath: 'Changed underneath', notpart: 'Not part of any unit process' };
  __.LABELS.upState = { proposed: 'Proposed', confirmed: 'Confirmed', changed: 'Changed' };
  const BLOWERS = ['BLW', 'M_BLW'], PUMPS = ['PMP', 'SUB_PMP', 'BT_PMP'], DOSING_PUMP = ['D_PMP'], VALVES = ['VALVE_2', 'VALVE_3'], DOSING_TANK = ['DOS_TANK'];
  const SIDE = [...BLOWERS, ...DOSING_PUMP, ...DOSING_TANK];   /* air and chemicals, not water: left out of the flow order */
  const TYPE_BY_ID = Object.fromEntries(UP_TYPES.map((t) => [t.id, t]));
  const TYPE_BY_ANCHOR = {}; UP_TYPES.forEach((t) => t.anchors.forEach((c) => { TYPE_BY_ANCHOR[c] = t.id; }));
  const ANCHOR_CODES = [...new Set([...UP_TYPES.flatMap((t) => t.anchors), ...GENERIC_TANKS])];
  const isAnchorCode = (code) => !!TYPE_BY_ANCHOR[code] || GENERIC_TANKS.includes(code);
  const stageLabel = (k) => (STAGES.find((s) => s.key === (k || null)) || STAGES[STAGES.length - 1]).label;
  const catByCode = (code) => (window.CATALOGUE_BY_CODE && window.CATALOGUE_BY_CODE[code]) || (window.CATALOGUE || []).find((c) => c.code === code) || null;
  const nameOfCode = (code) => (catByCode(code) || {}).type || code;
  const contentFromName = (t) => nameOfCode(t.contentFrom);

  /* ── small helpers ─────────────────────────────────────────────────────────────────────────── */
  const byTag = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });
  const plural = (n, w, ws) => __.plural(n, w, ws);
  const joinAnd = (xs) => __.joinAnd(xs);
  const fmt = (ms) => __.fmt(ms);
  const now = () => __.now();
  const dOf = (key) => __.dOf(key);
  const PS = (key) => __.PS(key);
  const eqRaw = (key, id) => __.eqRaw(key, id);
  const cached = (k, fn) => __.cached(k, fn);
  const codeOf = (e) => (e ? e.dbType || e.code : null);
  const tagOf = (key, id) => { const e = eqRaw(key, id); return e ? e.tag : id; };
  const tagsOf = (key, ids) => ids.map((id) => tagOf(key, id));
  const sortIds = (key, ids) => ids.slice().sort((a, b) => byTag(tagOf(key, a), tagOf(key, b)));
  const NUM_WORD = { 2: 'Both', 3: 'All three', 4: 'All four', 5: 'All five', 6: 'All six' };
  const allOf = (n) => NUM_WORD[n] || `All ${n}`;
  const pluralName = (s) => String(s).replace(/(\w+)$/, (w) => (/s$/.test(w) ? w : w + 's'));
  const stemOf = (label) => String(label).replace(/[\s\-–]*\d+$/, '').trim();
  const fmt1 = (v) => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  const isLive = (key) => !!PS(key) && PS(key).state === 'live';
  const needNote = (key, note) => (isLive(key) && !String(note || '').trim() ? { ok: false, error: 'Give a reason: this plant is Live.' } : null);
  const article = (phrase) => (/^UV\b/.test(phrase) ? 'a' : /^[aeiou]/i.test(phrase) ? 'an' : 'a');
  const lowerName = (name) => name.replace(/\bUV\b/, '\u0000').toLowerCase().replace('\u0000', 'UV');
  const triggerName = (key, a) => {
    const f = V.triggerName; if (typeof f === 'function') { try { const r = f(key, a.id); if (typeof r === 'string' && r) return r; } catch (e) { /* the data name below */ } }
    return String(a.name || '').replace(/ — /g, ' · ');
  };

  /* ── the plant graph ───────────────────────────────────────────────────────────────────────── */
  function linksOf(key) {
    const p = C.S && C.S.plants ? C.S.plants[key] : null;
    const m = p && p.scada && p.scada.model && p.scada.model.links;
    if (m && m.length) return m;
    const smp = (window.SCADA_SAMPLES || {})[key]; return (smp && smp.links) || [];
  }
  /* graph helpers over one plant's nodes and pipes; valves are transparent (a pump behind a valve still feeds the tank) */
  function graph(key) {
    return cached(`ka:graph:${key}`, () => {
      const d = dOf(key); if (!d) return null;
      const nodes = d.equipment.map((e) => ({ id: e.id, tag: e.tag, name: e.name, code: codeOf(e), typeName: e.type }));
      const N = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const links = linksOf(key).filter(([a, b]) => N[a] && N[b]);
      const out = {}, inn = {}; nodes.forEach((n) => { out[n.id] = []; inn[n.id] = []; });
      links.forEach(([a, b]) => { if (a !== b) { if (!out[a].includes(b)) out[a].push(b); if (!inn[b].includes(a)) inn[b].push(a); } });
      const isValve = (id) => VALVES.includes(N[id].code);
      const walk = (start, nb) => { const res = new Set(), seen = new Set([start]), st = [...nb[start]]; while (st.length) { const x = st.shift(); if (seen.has(x)) continue; seen.add(x); if (isValve(x)) st.push(...nb[x]); else res.add(x); } return [...res]; };
      const succ = (id) => walk(id, out), pred = (id) => walk(id, inn);
      const valvesFrom = (id, nb) => { const res = new Set(), seen = new Set([id]), st = [...nb[id]]; while (st.length) { const x = st.shift(); if (seen.has(x)) continue; seen.add(x); if (isValve(x)) { res.add(x); st.push(...nb[x]); } } return res; };
      const reach = (from, to) => { const seen = new Set(), st = [...out[from]]; while (st.length) { const x = st.pop(); if (x === to) return true; if (seen.has(x)) continue; seen.add(x); st.push(...out[x]); } return false; };
      const neighbours = (id) => [...new Set([...(out[id] || []), ...(inn[id] || [])])].sort();
      return { nodes, N, links, out, inn, succ, pred, valvesFrom, reach, isValve, neighbours };
    });
  }
  /* the signature of a node's pipes, kept on a structure edit: when it differs later the edit is "Changed underneath" */
  const linkSigOf = (key, nodeId) => { const g = graph(key); return g && g.N[nodeId] ? g.neighbours(nodeId).join(',') : ''; };

  /* ── identification (pure: the same plant graph always gives the same answer) ────────────────── */
  function identify(key) {
    return cached(`ka:identify:${key}`, () => {
      const g = graph(key); if (!g) return null;
      const { nodes, N, succ, pred, valvesFrom, reach, out } = g;
      const anchors = nodes.filter((n) => isAnchorCode(n.code));
      const isUpNode = (id) => isAnchorCode(N[id].code);
      const tags = (ids) => ids.map((i) => N[i].tag).sort(byTag).join(', ');
      /* step 1: the type of each unit process; a specific survey type decides it, a generic tank takes the first rule that fits */
      const upType = {}, why = {};
      anchors.forEach((n) => {
        const t = TYPE_BY_ANCHOR[n.code]; if (!t) return; upType[n.id] = t;
        const nm = lowerName(TYPE_BY_ID[t].name); const phrase = /reactor$/.test(nm) ? nm : `${nm} unit`;
        why[n.id] = `Its type, ${n.typeName}, makes it ${article(phrase)} ${phrase}`;
      });
      const st = (id) => (upType[id] ? TYPE_BY_ID[upType[id]] : null);
      anchors.filter((n) => !upType[n.id]).forEach((n) => {
        const p = pred(n.id);
        const fromSettler = p.length && p.every((x) => [...PUMPS, ...DOSING_PUMP].includes(N[x].code) && pred(x).some((y) => st(y) && st(y).settling));
        if (fromSettler) { upType[n.id] = 'sludge-holding'; why[n.id] = `Fed by pumps that draw sludge from ${tags([...new Set(p.flatMap((x) => pred(x).filter((y) => st(y) && st(y).settling)))])}`; return; }
        const dose = p.filter((x) => DOSING_PUMP.includes(N[x].code) || DOSING_TANK.includes(N[x].code)); const sec = p.filter((x) => st(x) && st(x).stage === 'secondary');
        if (dose.length && sec.length) { upType[n.id] = 'chlorine-contact'; why[n.id] = `Takes settled water from ${tags(sec)} and a chemical dose from ${tags(dose)}`; return; }
        const ter = p.filter((x) => st(x) && st(x).stage === 'tertiary');
        if (ter.length) { upType[n.id] = 'storage'; why[n.id] = `Fed by ${tags(ter)} after treatment`; return; }
        if (!p.length) { upType[n.id] = 'sump'; why[n.id] = 'Nothing upstream but the plant inlet'; return; }
        upType[n.id] = 'equalisation';
        const water = p.filter((x) => !BLOWERS.includes(N[x].code) && !DOSING_TANK.includes(N[x].code) && !DOSING_PUMP.includes(N[x].code));
        const bioAfter = anchors.some((x) => st(x.id) && st(x.id).bio && reach(n.id, x.id));
        why[n.id] = `Fed by ${tags(water.length ? water : p)}${bioAfter ? ', ahead of the biological treatment' : ''}`;
      });
      /* step 2: participation, by rules a to e; the first rule that places a piece of equipment in a unit process wins */
      const mem = []; const add = (eq, up, rule, role, w) => { if (!mem.some((m) => m.eqId === eq && m.upId === up)) mem.push({ eqId: eq, upId: up, rule, role, why: w, i: mem.length }); };
      nodes.filter((n) => BLOWERS.includes(n.code)).forEach((b) => succ(b.id).filter(isUpNode).forEach((u) => add(b.id, u, 'a', 'blower', 'Upstream blowers always participate')));
      const loopReactors = (u, pumpId) => anchors.filter((x) => st(x.id) && st(x.id).bio && (x.id === u || reach(u, x.id)) && reach(x.id, pumpId)).map((x) => x.id);
      nodes.filter((n) => PUMPS.includes(n.code)).forEach((p) => {
        succ(p.id).filter(isUpNode).forEach((u) => {
          if (st(u).ro) add(p.id, u, 'b', 'pump', 'Feeds this reverse-osmosis unit');
          else if (st(u).bio && reach(u, p.id)) loopReactors(u, p.id).forEach((r) => add(p.id, r, r === u ? 'b' : 'c', 'recirc', r === u ? 'Feeds this reactor and is fed back by it (recirculation)' : `Recirculates through this reactor's loop (back to ${N[u].tag})`));
        });
      });
      anchors.filter((f) => st(f.id).filtration).forEach((f) => {
        const outValves = valvesFrom(f.id, out);
        nodes.filter((n) => PUMPS.includes(n.code)).forEach((p) => {
          if (pred(p.id).includes(f.id)) add(p.id, f.id, 'c', 'filter', 'Takes the outlet of this filter (permeate)');
          else { const pv = valvesFrom(p.id, out); if ([...pv].some((v) => outValves.has(v))) add(p.id, f.id, 'c', 'filter', "Pumps into this filter's outlet line (backwash)"); }
        });
      });
      nodes.filter((n) => DOSING_TANK.includes(n.code)).forEach((t) => {
        succ(t.id).filter(isUpNode).forEach((u) => { add(t.id, u, 'd', 'dosing', 'A dosing tank that feeds this unit process'); valvesFrom(t.id, out).forEach((v) => { if (reach(v, u)) add(v, u, 'e', 'valve', 'Between a dosing tank and this unit process'); }); });
        succ(t.id).filter((q) => [...PUMPS, ...DOSING_PUMP].includes(N[q].code)).forEach((q) => succ(q).filter(isUpNode).forEach((u) => {
          add(t.id, u, 'd', 'dosing', `A dosing tank one pump (${N[q].tag}) away`); add(q, u, 'd', 'dosing', `Doses from ${N[t.id].tag} into this unit process`);
          valvesFrom(q, out).forEach((v) => { if (reach(v, u)) add(v, u, 'e', 'valve', 'Between a dosing tank and this unit process'); });
        }));
      });
      anchors.filter((f) => st(f.id).filtration).forEach((f) => { [...out[f.id], ...g.inn[f.id]].filter(g.isValve).forEach((v) => add(v, f.id, 'e', 'valve', 'A valve next to this filter')); });
      /* equipment no rule placed: its why names its pipe neighbours */
      const equipment = nodes.filter((n) => !isUpNode(n.id));
      const unclassified = equipment.filter((e) => !mem.some((m) => m.eqId === e.id)).map((e) => {
        const p = pred(e.id), s = succ(e.id);
        const w = !p.length && !s.length ? 'No pipes drawn. No rule matches.' : `${p.length ? 'Fed by ' + tags(p) : 'Nothing drawn upstream'}; ${s.length ? 'feeds ' + tags(s) : 'feeds nothing drawn'}. No rule matches.`;
        return { eqId: e.id, why: w };
      });
      /* step 3: control groups: blowers, or pumps with the same function (the label stem), that feed exactly the same set */
      const cgMap = {}; const cgKeys = [];
      nodes.filter((n) => [...BLOWERS, ...PUMPS, ...DOSING_PUMP].includes(n.code)).forEach((n) => {
        const D = succ(n.id).sort(); if (!D.length) return; const kind = BLOWERS.includes(n.code) ? 'blower' : 'pump';
        const k = `${kind}|${kind === 'pump' ? stemOf(n.name) : ''}|${D.join(',')}`;
        if (!cgMap[k]) { cgMap[k] = { kind, stem: stemOf(n.name), feeds: D, members: [] }; cgKeys.push(k); }
        cgMap[k].members.push(n.id);
      });
      let cgs = cgKeys.map((k) => cgMap[k]).filter((x) => x.members.length >= 2).map((x) => {
        const memberIds = x.members.slice().sort((a, b) => byTag(N[a].tag, N[b].tag)); const feedsTags = x.feeds.map((i) => N[i].tag).sort(byTag);
        const name = pluralName(x.stem);
        const w = x.kind === 'blower' ? `${allOf(memberIds.length)} feed the same downstream set (${feedsTags.join(', ')})` : `${allOf(memberIds.length)} are ${name} and feed the same downstream set (${feedsTags.join(', ')})`;
        return { id: `cg_${N[memberIds[0]].tag.toLowerCase()}`, name, kind: x.kind, memberIds, feeds: x.feeds.slice(), feedsTags, why: w };
      });
      const names = {}; cgs.forEach((c) => { names[c.name] = (names[c.name] || 0) + 1; });
      cgs = cgs.map((c) => (names[c.name] > 1 ? { ...c, name: `${c.name} → ${c.feedsTags.join(', ')}` } : c));
      /* step 4: flow order, inlet to outlet, over the water pipes (air and chemical lines left out), loops cut at their back edge */
      const wout = {}; nodes.forEach((n) => { wout[n.id] = []; });
      g.links.forEach(([a, b]) => { if (!SIDE.includes(N[a].code) && !wout[a].includes(b)) wout[a].push(b); });
      const indeg = {}; nodes.forEach((n) => { indeg[n.id] = 0; }); nodes.forEach((n) => wout[n.id].forEach((b) => { indeg[b]++; }));
      const color = {}, back = new Set();
      const dfs = (u) => { color[u] = 1; wout[u].forEach((v) => { if (color[v] === 1) back.add(u + '>' + v); else if (!color[v]) dfs(v); }); color[u] = 2; };
      nodes.filter((n) => !indeg[n.id]).sort((a, b) => byTag(a.tag, b.tag)).forEach((s) => { if (!color[s.id]) dfs(s.id); });
      nodes.forEach((n) => { if (!color[n.id]) dfs(n.id); });
      const depth = {}; const lp = (u) => { if (depth[u] != null) return depth[u]; const ins = nodes.filter((m) => wout[m.id].includes(u) && !back.has(m.id + '>' + u)); depth[u] = ins.length ? Math.max(...ins.map((m) => lp(m.id) + 1)) : 0; return depth[u]; };
      nodes.forEach((n) => lp(n.id));
      const ups = anchors.map((n) => ({ id: n.id, tag: n.tag, name: n.name, code: n.code, typeName: n.typeName, typeId: upType[n.id], generic: GENERIC_TANKS.includes(n.code), why: why[n.id], depth: depth[n.id] }))
        .sort((a, b) => a.depth - b.depth || byTag(a.tag, b.tag)).map((u, i) => ({ ...u, order: i, stage: TYPE_BY_ID[u.typeId].stage }));
      const upOrder = Object.fromEntries(ups.map((u) => [u.id, u.order]));
      const RULES = ['a', 'b', 'c', 'd', 'e'];
      mem.sort((a, b) => upOrder[a.upId] - upOrder[b.upId] || RULES.indexOf(a.rule) - RULES.indexOf(b.rule) || a.i - b.i);
      /* the rows a person decides in the structure pass */
      const upsOfEq = {}; mem.forEach((m) => { (upsOfEq[m.eqId] = upsOfEq[m.eqId] || []).push(m.upId); });
      const sharedEq = Object.keys(upsOfEq).filter((id) => upsOfEq[id].length > 1);
      const d = dOf(key); const rows = [];
      ups.forEach((u) => {
        rows.push({ rowId: `up:${u.id}`, kind: 'up', group: u.id, upId: u.id, cgId: null, title: `${u.tag} · ${TYPE_BY_ID[u.typeId].name}`, why: u.why, eqIds: [u.id], sensorIds: [], shared: false, alsoIn: [] });
        RULES.forEach((r) => {
          const ms = mem.filter((m) => m.upId === u.id && m.rule === r); if (!ms.length) return;
          const ids = ms.map((m) => m.eqId); const also = [...new Set(ids.flatMap((id) => upsOfEq[id].filter((x) => x !== u.id)))].sort((a, b) => upOrder[a] - upOrder[b]);
          rows.push({ rowId: `m:${u.id}:${r}`, kind: 'members', group: u.id, upId: u.id, cgId: null, rule: r, title: ids.map((id) => N[id].tag).join(', '), why: [...new Set(ms.map((m) => m.why))].join('; '), eqIds: ids, sensorIds: [], shared: also.length > 0, alsoIn: also.map((x) => ({ upId: x, tag: N[x].tag })) });
        });
        const sens = d.sensors.filter((s) => s.on === 'eq:' + u.id && !s.nextPhase);
        if (sens.length) rows.push({ rowId: `r:${u.id}`, kind: 'readings', group: u.id, upId: u.id, cgId: null, title: `${sens.map((s) => s.name).join(', ')} · ${u.tag}'s ${sens.length === 1 ? 'sensor' : 'sensors'}`, why: 'Sensors on this unit process', eqIds: [], sensorIds: sens.map((s) => s.id), shared: false, alsoIn: [] });
      });
      cgs.forEach((c) => rows.push({ rowId: `cg:${c.id}`, kind: 'cg', group: 'cgs', upId: null, cgId: c.id, title: `${c.name} · ${c.memberIds.map((i) => N[i].tag).join(', ')}`, why: c.why, eqIds: c.memberIds.slice(), sensorIds: [], shared: false, alsoIn: [] }));
      unclassified.forEach((x) => rows.push({ rowId: `u:${x.eqId}`, kind: 'unclassified', group: 'unclassified', upId: null, cgId: null, title: `${N[x.eqId].tag} · ${N[x.eqId].name} · ${N[x.eqId].typeName}`, why: x.why, eqIds: [x.eqId], sensorIds: [], shared: false, alsoIn: [] }));
      const proposed = rows.filter((r) => r.kind !== 'unclassified').length;
      return {
        plant: key, ups, members: mem.map(({ i, ...m }) => ({ ...m })), cgs, unclassified, rows,
        counts: { nodes: nodes.length, ups: ups.length, equipment: equipment.length, sensors: d.sensors.length, memberships: mem.length, memberRows: rows.filter((r) => r.kind === 'members').length, readingsRows: rows.filter((r) => r.kind === 'readings').length, cgs: cgs.length, unclassified: unclassified.length, rows: rows.length, proposed, sharedEquipment: sharedEq.length, sharedRows: rows.filter((r) => r.shared).length },
      };
    });
  }
  /* the signature of each proposal row: if it changes when identification runs again, the row is "changed" */
  function rowSigs(I) {
    const out = {};
    I.rows.forEach((r) => { out[r.rowId] = r.kind === 'up' ? (I.ups.find((u) => u.id === r.upId) || {}).typeId : r.kind === 'readings' ? r.sensorIds.slice().sort().join(',') : r.kind === 'cg' ? `${r.eqIds.slice().sort().join(',')}>${((I.cgs.find((c) => c.id === r.cgId) || {}).feeds || []).join(',')}` : r.kind === 'members' ? r.eqIds.slice().sort().join(',') : 'u'; });
    return out;
  }
  const isUp = (key, nodeId) => { const e = eqRaw(key, nodeId); return !!e && isAnchorCode(codeOf(e)); };

  /* ── stored structure state (decisions, flags, undo) ─────────────────────────────────────────── */
  const stOf = (key) => (S() && S().structure ? S().structure[key] || null : null);
  function ensureSt(key) {
    const s = S(); if (!s.structure) s.structure = {};
    if (!s.structure[key]) { const I = identify(key); const t = (__.PLANT_META[key] || {}).since || now(); s.structure[key] = { readAt: t, runAt: t, runBy: 'Automatic', sig: I ? rowSigs(I) : {}, decisions: {}, confirmedAt: null, confirmedBy: null, flags: {}, undo: [] }; }
    return s.structure[key];
  }
  const STRUCT_KINDS = ['member', 'uptype', 'cg'];
  const ovLive = (o) => !o.endedAt && (o.status == null || o.status === 'active') && !o.suspendedBy;
  const structOvs = (key) => (S() ? S().overrides.filter((o) => o.plant === key && o.target && STRUCT_KINDS.includes(o.target.kind) && ovLive(o)) : []);

  /* ── the effective structure: proposals, with every decision and hand edit laid over them ──────── */
  /* extra: edits not saved yet ({op:'add'|'remove', upId, eqId} · {op:'type', upId, typeId} · {op:'notpart', eqId} ·
     {op:'cgmake', cgId, eqIds, name} · {op:'cgedit', cgId, eqIds} · {op:'cgreject', cgId}), for the consequence shown before saving */
  function build(key, extra) {
    const I = identify(key); if (!I) return null; const st = stOf(key) || {}; const dec = st.decisions || {};
    const N = graph(key).N;
    const typeOf = {}, typeOv = {}; I.ups.forEach((u) => { typeOf[u.id] = u.typeId; });
    const mem = new Map(); const removed = new Map();
    I.members.forEach((m) => { const rowId = `m:${m.upId}:${m.rule}`; const dd = dec[rowId]; mem.set(`${m.upId}|${m.eqId}`, { ...m, rowId, state: dd && dd.v === 'accepted' ? 'confirmed' : 'proposed', overrideId: null }); });
    const cgs = I.cgs.map((c) => { const dd = dec[`cg:${c.id}`]; return { ...c, proposedMemberIds: c.memberIds.slice(), state: dd ? (dd.v === 'accepted' ? 'confirmed' : 'rejected') : 'proposed', overrideId: null, made: false }; });
    const notPartIds = new Set(Object.keys(dec).filter((k) => k.startsWith('u:') && dec[k].v === 'notpart').map((k) => k.slice(2)));
    const roleByType = (eqId) => { const c = N[eqId] ? N[eqId].code : null; return BLOWERS.includes(c) ? 'blower' : DOSING_TANK.includes(c) || DOSING_PUMP.includes(c) ? 'dosing' : VALVES.includes(c) ? 'valve' : PUMPS.includes(c) ? 'pump' : 'other'; };
    const apply = (op, o) => {
      if (op.op === 'type') { typeOf[op.upId] = op.typeId; if (o) typeOv[op.upId] = o; return; }
      if (op.op === 'add' || op.op === 'remove') {
        const k = `${op.upId}|${op.eqId}`;
        if (op.op === 'remove') { if (mem.has(k)) { const m = mem.get(k); mem.delete(k); if (m.state !== 'added') removed.set(k, { ...m, overrideId: o ? o.id : null, at: o ? o.at : null, by: o ? o.author : null, note: o ? o.note : '' }); } return; }
        if (removed.has(k)) { const m = removed.get(k); removed.delete(k); mem.set(k, { ...m, overrideId: null }); return; }
        if (!mem.has(k)) mem.set(k, { eqId: op.eqId, upId: op.upId, rule: null, role: roleByType(op.eqId), why: (o && o.note) || 'Added by hand', rowId: null, state: 'added', overrideId: o ? o.id : null, at: o ? o.at : null, by: o ? o.author : null });
        notPartIds.delete(op.eqId); return;
      }
      if (op.op === 'notpart') { notPartIds.add(op.eqId); return; }
      if (op.op === 'cgreject') { const c = cgs.find((x) => x.id === op.cgId); if (c) { c.state = 'rejected'; c.overrideId = o ? o.id : null; } return; }
      if (op.op === 'cgedit') { const c = cgs.find((x) => x.id === op.cgId); if (c) { c.memberIds = sortIds(key, op.eqIds); c.state = c.made ? 'made' : 'changed'; c.overrideId = o ? o.id : null; } return; }
      if (op.op === 'cgmake') {
        const ex = cgs.find((x) => x.id === op.cgId);
        const feeds = [...new Set(op.eqIds.flatMap((id) => graph(key).succ(id)))].sort(); const feedsTags = feeds.map((i) => N[i].tag).sort(byTag);
        const c = { id: op.cgId, name: op.name, kind: op.eqIds.every((id) => BLOWERS.includes(N[id].code)) ? 'blower' : 'pump', memberIds: sortIds(key, op.eqIds), proposedMemberIds: null, feeds, feedsTags, why: (o && o.note) || 'Made by hand', state: 'made', overrideId: o ? o.id : null, made: true };
        if (ex && ex.made) Object.assign(ex, c); else if (!ex) cgs.push(c);
      }
    };
    structOvs(key).forEach((o) => {
      const t = o.target;
      if (t.kind === 'uptype') apply({ op: 'type', upId: t.upId, typeId: o.value }, o);
      else if (t.kind === 'member') apply({ op: t.op === 'remove' ? 'remove' : 'add', upId: t.upId, eqId: t.eqId }, o);
      else if (t.kind === 'cg') apply(t.op === 'reject' ? { op: 'cgreject', cgId: t.cgId } : t.op === 'make' ? { op: 'cgmake', cgId: t.cgId, eqIds: o.value || [], name: o.name || t.name || 'Control group' } : { op: 'cgedit', cgId: t.cgId, eqIds: o.value || [] }, o);
    });
    (extra || []).forEach((op) => apply(op, null));
    const byEq = {}, byUp = {}; [...mem.values()].forEach((m) => { (byEq[m.eqId] = byEq[m.eqId] || []).push(m); (byUp[m.upId] = byUp[m.upId] || []).push(m); });
    const upOrder = Object.fromEntries(I.ups.map((u) => [u.id, u.order]));
    Object.values(byEq).forEach((l) => l.sort((a, b) => upOrder[a.upId] - upOrder[b.upId]));
    Object.values(byUp).forEach((l) => l.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || byTag(N[a.eqId].tag, N[b.eqId].tag)));
    const cgOf = {}; cgs.filter((c) => c.state !== 'rejected').forEach((c) => c.memberIds.forEach((id) => { (cgOf[id] = cgOf[id] || []).push(c.id); }));
    const placement = {}; I.ups.forEach((u) => { placement[u.id] = null; });
    graph(key).nodes.filter((n) => !isAnchorCode(n.code)).forEach((n) => { placement[n.id] = (byEq[n.id] || []).length ? 'placed' : notPartIds.has(n.id) ? 'notpart' : 'unclassified'; });
    return { I, typeOf, typeOv, mem, byEq, byUp, removed: [...removed.values()], cgs, cgOf, placement, notPartIds, dec };
  }
  const eff = (key) => cached(`ka:eff:${key}`, () => build(key, null));

  /* ── criticality tier from the structure ─────────────────────────────────────────────────────── */
  const RANKT = { A: 3, B: 2, C: 1 };
  const rankT = (t) => RANKT[t] || 0;
  /* the type's default tier: a published library change to it first, else the catalogue's */
  const publishedTier = (code) => { try { const tf = S() && S().lib && S().lib.typeFields; const x = tf && code ? tf['eq:' + code] : null; return (x && x.defaultTier) || null; } catch (err) { return null; } };
  const libTierOf = (e) => { const c = (window.CATALOGUE_BY_TYPE && window.CATALOGUE_BY_TYPE[e.type]) || (window.CATALOGUE || []).find((x) => x.type === e.type); return publishedTier(c && c.code) || (c && c.tier) || e.tier || 'C'; };
  const ovTier = (key, eqId) => __.ovTier(key, eqId);
  /* a unit process's tier is its node's: the library tier of its survey type, or an override */
  const upTier = (key, upId) => { const ov = ovTier(key, upId); const e = eqRaw(key, upId); return ov ? ov.value : e ? libTierOf(e) : 'C'; };
  function derivedTier(key, eqId, E) {
    const e = eqRaw(key, eqId); if (!e) return null; const lib = libTierOf(e);
    if (isUp(key, eqId)) return { base: lib, src: 'library', from: [] };
    const ms = (E.byEq[eqId] || []); let best = lib; ms.forEach((m) => { const t = upTier(key, m.upId); if (rankT(t) > rankT(best)) best = t; });
    if (rankT(best) > rankT(lib)) return { base: best, src: 'derived', from: ms.filter((m) => upTier(key, m.upId) === best).map((m) => m.upId) };
    return { base: lib, src: 'library', from: [] };
  }
  const REASON_WORD = { physical: 'Physical', regulatory: 'Regulatory or client', structural: 'Structural', tuning: 'Tuning', temporary: 'Temporary', migrated: 'Migrated', tuned: 'Tuning', unrecorded: 'Migrated', fornow: 'Temporary' };
  const dMon = (ms) => { if (ms == null) return ''; const p = __.parts(ms); return `${p.day} ${p.mon}`; };
  /* the chip for a value, from the ledger's one formatter once it is loaded; otherwise the same words here */
  function chipOf(src) {
    const f = V.chipFor; if (typeof f === 'function') { try { const c = f(src); if (c && c.text) return c; } catch (e) { /* the words below */ } }
    if (src.src === 'override') {
      if (src.overrideState === 'basemoved') return { text: 'Base moved', tone: 'moved', sub: `Library changed ${src.recordBase} → ${src.base} since you overrode it`, small: null };
      const who = src.author === ME ? 'you' : src.author || 'not recorded'; const rl = REASON_WORD[src.reason] || (V.LABELS.reason && typeof V.LABELS.reason[src.reason] === 'string' ? V.LABELS.reason[src.reason] : 'Tuning');
      return { text: `Override · ${rl} · ${who} · ${dMon(src.at)}${src.expires ? ` · expires ${dMon(src.expires)}` : src.reviewBy ? ` · review by ${dMon(src.reviewBy)}` : ''}`, tone: 'ovr', sub: null, small: `${src.baseSource === 'derived' ? 'Derived' : 'Library'}: ${src.base}` };
    }
    if (src.src === 'derived') return { text: `Derived · ${src.derived.ruleText}${src.derived.paramText ? ` (${src.derived.paramText})` : ''}`, tone: 'der', sub: null, small: null };
    return { text: `Library · ${src.owner.name} v${src.owner.version}`, tone: 'lib', sub: null, small: null };
  }
  const typeVersion = (code) => { const s = S(); const tv = s && s.lib && s.lib.typeVersions; return (tv && tv[`eq:${code}`]) || 1; };
  /* Override first, then Derived (the highest of the type's tier and the tiers of the unit processes it takes part in, never
     lower), then the library; the shape every value source has, so the ledger reads its base from here */
  function tierInfo(key, eqId) {
    const e = eqRaw(key, eqId); if (!e) return null; const E = eff(key); if (!E) return null;
    const dt = derivedTier(key, eqId, E); const lib = libTierOf(e); const ov = ovTier(key, eqId);
    const upTags = dt.from.map((id) => tagOf(key, id));
    const info = {
      value: ov ? ov.value : dt.base, src: ov ? 'override' : dt.src, base: dt.base, baseSource: dt.src, libValue: lib,
      derivedFrom: dt.from.slice(), derived: dt.src === 'derived' ? { ruleText: `highest of ${upTags.join(', ')}`, paramText: null } : null,
      owner: { code: codeOf(e), name: e.type, version: typeVersion(codeOf(e)) },
      overrideId: ov ? ov.id : null, recordBase: ov ? ov.base : null, reason: ov ? ov.reason : null, note: ov ? ov.note || '' : null, author: ov ? ov.author : null, at: ov ? ov.at : null, reviewBy: ov ? ov.reviewBy : null, expires: ov ? ov.expires || null : null,
      overrideState: null,
    };
    if (ov) info.overrideState = typeof V.ovState === 'function' ? (() => { try { return V.ovState(ov); } catch (x) { return null; } })() : null;
    if (ov && !info.overrideState) info.overrideState = ov.base != null && ov.base !== dt.base ? 'basemoved' : 'active';
    info.chip = chipOf(info); info.chipText = info.chip.text; info.label = `Criticality tier ${info.value}`;
    return info;
  }
  /* the stored tier of each node follows its effective tier, so v6's own pages and the ledger's checks read the same value */
  function syncTiers(key, ids) {
    const d = dOf(key); if (!d) return; __.touch();
    const vals = (ids || d.equipment.map((e) => e.id)).map((id) => [eqRaw(key, id), tierInfo(key, id)]);
    vals.forEach(([e, ti]) => { if (!e || !ti) return; e.tier = ti.value; if (ti.overrideId) e.tierReason = ti.note || e.tierReason; else delete e.tierReason; });
    __.touch();
  }

  /* ── views ──────────────────────────────────────────────────────────────────────────────────── */
  const upTypeOf = (key, upId) => { const E = eff(key); return E && E.typeOf[upId] ? TYPE_BY_ID[E.typeOf[upId]] : null; };
  function subjectOf(key, ref) {
    if (ref == null) return null; const d = dOf(key); if (!d) return null;
    const r = typeof ref === 'string' ? (ref === 'plant' || ref === key ? { kind: 'plant' } : { kind: 'eq', id: ref }) : ref;
    if (r.kind === 'plant') return { kind: 'plant', id: key, tag: null, name: d.plant.name, typeName: null, text: 'The plant', href: `#/p/${key}` };
    if (r.kind === 'cg') return null;
    const e = eqRaw(key, r.id); if (!e) return null;
    if (isUp(key, e.id)) { const t = upTypeOf(key, e.id); return { kind: 'up', id: e.id, tag: e.tag, name: e.name, typeName: t ? t.name : e.type, typeId: t ? t.id : null, stage: t ? t.stage : null, stageLabel: stageLabel(t ? t.stage : null), text: `${e.tag} · ${t ? t.name : e.type}`, href: `#/p/${key}/up/${e.id}` }; }
    return { kind: 'eq', id: e.id, tag: e.tag, name: e.name, typeName: e.type, text: `${e.tag} · ${e.type}`, href: `#/p/${key}/eq/${e.id}` };
  }
  function membershipOf(key, eqId) {
    const E = eff(key); if (!E) return null; const N = graph(key).N;
    const list = (E.byEq[eqId] || []).map((m) => { const t = upTypeOf(key, m.upId); return { upId: m.upId, tag: N[m.upId].tag, typeName: t ? t.name : '', state: m.state, stateLabel: __.LABELS.membership[m.state], role: m.role, roleLabel: ROLE_LABEL[m.role] || 'Other', rule: m.rule, why: m.why, overrideId: m.overrideId || null }; });
    const cgsL = (E.cgOf[eqId] || []).map((id) => { const c = E.cgs.find((x) => x.id === id); return { cgId: id, name: c ? c.name : id }; });
    const removedL = E.removed.filter((m) => m.eqId === eqId).map((m) => ({ upId: m.upId, tag: N[m.upId].tag, at: m.at, by: m.by, note: m.note, overrideId: m.overrideId }));
    return { eqId, participatesIn: list, controlGroups: cgsL, removedFrom: removedL, placement: E.placement[eqId] || null, placementLabel: E.placement[eqId] ? __.LABELS.membership[E.placement[eqId] === 'placed' ? (list.some((m) => m.state === 'added') ? 'added' : list.some((m) => m.state === 'confirmed') ? 'confirmed' : 'proposed') : E.placement[eqId]] : null };
  }
  function participantsOf(key, upId, E) {
    const N = graph(key).N; const d = dOf(key);
    return (E.byUp[upId] || []).map((m) => {
      const e = eqRaw(key, m.eqId) || {}; const also = (E.byEq[m.eqId] || []).filter((x) => x.upId !== upId).map((x) => ({ upId: x.upId, tag: N[x.upId].tag }));
      const cg = (E.cgOf[m.eqId] || [])[0] || null;
      return { eqId: m.eqId, tag: e.tag, name: e.name, typeName: e.type, role: m.role, roleLabel: ROLE_LABEL[m.role] || 'Other', state: m.state, stateLabel: __.LABELS.membership[m.state], rule: m.rule, why: m.why, alsoIn: also, shared: also.length > 0, cgId: cg, overrideId: m.overrideId || null, underneath: false, running: e.status === 'running', sensorIds: d.sensors.filter((s) => s.on === 'eq:' + m.eqId).map((s) => s.id) };
    });
  }
  function upView(key, u, E) {
    const e = eqRaw(key, u.id); const d = dOf(key); const P = PS(key); const t = TYPE_BY_ID[E.typeOf[u.id]];
    const dd = E.dec[`up:${u.id}`]; const typeState = E.typeOv[u.id] ? 'changed' : dd && dd.v === 'accepted' ? 'confirmed' : 'proposed';
    const ti = V.tierInfo(key, u.id); const parts = participantsOf(key, u.id, E);
    const drawnDiffers = !!e.code && !!e.dbType && e.code !== e.dbType;
    const alertsOn = d.alerts.filter((a) => a.subject && a.subject.id === u.id);
    return {
      id: u.id, plant: key, tag: e.tag, name: e.name, typeId: t.id, typeName: t.name, typeState, typeStateLabel: __.LABELS.upState[typeState], proposedTypeId: u.typeId, proposedTypeName: TYPE_BY_ID[u.typeId].name, why: u.why, generic: u.generic,
      stage: t.stage, stageLabel: stageLabel(t.stage), equipmentType: e.type, code: codeOf(e), drawnAs: drawnDiffers ? (e.drawnAs || (C.dbName ? C.dbName(e.code) : e.code)) : null,
      drawnFact: drawnDiffers ? `Drawn in the plant graph as ${e.drawnAs || (C.dbName ? C.dbName(e.code) : e.code)}; stored in the survey as ${e.type}.` : null,
      tier: ti ? ti.value : e.tier, tierSource: ti, order: u.order, sensorIds: d.sensors.filter((s) => s.on === 'eq:' + u.id).map((s) => s.id),
      participants: parts, removed: E.removed.filter((m) => m.upId === u.id).map((m) => ({ eqId: m.eqId, tag: tagOf(key, m.eqId), at: m.at, by: m.by, note: m.note, overrideId: m.overrideId })),
      cgIds: E.cgs.filter((c) => c.state !== 'rejected' && c.memberIds.some((id) => parts.some((p) => p.eqId === id))).map((c) => c.id),
      counts: { triggers: alertsOn.filter((a) => V.alertState(key, a.id) === 'active').length, openIssues: P.issues.filter((i) => i.status !== 'closed' && ((i.subject && i.subject.id === u.id) || (!i.subject && i.eqId === u.id))).length, tasks: d.schedules.filter((x) => x.status === 'active' && x.subject && x.subject.id === u.id).length },
      href: `#/p/${key}/up/${u.id}`, basinEqId: u.id,
    };
  }
  function unitProcesses(key, opts) {
    const o = opts || {}; const all = cached(`ka:ups:${key}`, () => { const E = eff(key); return E ? E.I.ups.map((u) => upView(key, u, E)) : []; });
    return 'stage' in o ? all.filter((u) => (u.stage || null) === (o.stage === 'none' ? null : o.stage || null)) : all.slice();
  }
  const unitProcess = (key, id) => unitProcesses(key).find((u) => u.id === id) || null;
  const upOfBasin = (key, nodeId) => (isUp(key, nodeId) ? unitProcess(key, nodeId) : null);

  function cgView(key, c, E) {
    const N = graph(key).N;
    const tasks = __.buildTasks(key); const work = {}; const order = [];
    c.memberIds.forEach((id) => tasks.filter((t) => t.eqIds.includes(id)).forEach((t) => { if (!work[t.name]) { work[t.name] = { name: t.name, members: 0, perDay: 0 }; order.push(t.name); } work[t.name].members++; work[t.name].perDay += t.perDay; }));
    /* how often, in the unit that reads as a plain number: "12 a day", "0.7 a week", "0.9 a month" */
    const rate = (pd) => (pd >= 0.1 ? `${fmt1(pd)} a day` : pd * 7 >= 0.1 ? `${fmt1(pd * 7)} a week` : `${fmt1(pd * 30)} a month`);
    const memberWork = order.map((n) => { const w = work[n]; const pd = Math.round(w.perDay * 1000) / 1000; return { name: w.name, members: w.members, perDay: pd, text: `${w.name} · ${w.members === c.memberIds.length ? `on each of ${plural(c.memberIds.length, 'member')}` : `on ${w.members} of ${plural(c.memberIds.length, 'member')}`} · ${rate(pd)}` }; });
    /* members that feed different unit processes from the rest say so */
    const g = graph(key); const fk = (id) => g.succ(id).slice().sort().join(','); const groups = {}; c.memberIds.forEach((id) => { (groups[fk(id)] = groups[fk(id)] || []).push(id); });
    const warnings = []; const keys = Object.keys(groups);
    if (keys.length > 1) { const main = keys.sort((a, b) => groups[b].length - groups[a].length)[0]; const mainFeeds = g.succ(groups[main][0]).map((i) => N[i].tag).sort(byTag); keys.filter((k) => k !== main).forEach((k) => groups[k].forEach((id) => { const f = g.succ(id).map((i) => N[i].tag).sort(byTag); warnings.push(`${N[id].tag} feeds ${f.length ? f.join(', ') : 'nothing drawn'}; the others feed ${mainFeeds.length ? mainFeeds.join(', ') : 'nothing drawn'}`); })); }
    const ups = [...new Set(c.memberIds.flatMap((id) => (E.byEq[id] || []).map((m) => m.upId)))];
    return {
      id: c.id, plant: key, name: c.name, kind: c.kind, memberIds: c.memberIds.slice(), members: c.memberIds.map((id) => ({ eqId: id, tag: N[id].tag, name: N[id].name, typeName: N[id].typeName, state: c.state === 'proposed' ? 'proposed' : 'confirmed', running: (eqRaw(key, id) || {}).status === 'running', participatesIn: (E.byEq[id] || []).map((m) => N[m.upId].tag) })),
      feeds: c.feeds.slice(), feedsTags: c.feedsTags.slice(), upIds: ups, state: c.state, stateLabel: { proposed: 'Proposed', confirmed: 'Confirmed', changed: 'Changed', made: 'Added', rejected: 'Rejected' }[c.state], why: c.why,
      setpoint: null, setpointText: 'Setpoint: not recorded. It arrives with remote control; nothing in this study reads it.', warnings, memberWork, href: `#/p/${key}/cg/${c.id}`,
    };
  }
  function controlGroups(key, opts) {
    const all = cached(`ka:cgs:${key}`, () => { const E = eff(key); return E ? E.cgs.map((c) => cgView(key, c, E)) : []; });
    return opts && opts.all ? all.slice() : all.filter((c) => c.state !== 'rejected');
  }
  const controlGroup = (key, id) => controlGroups(key, { all: true }).find((c) => c.id === id) || null;

  /* the rows of the structure pass with their decisions */
  function rowState(row, E) {
    const dd = E.dec[row.rowId];
    if (row.kind === 'unclassified') { const p = E.placement[row.eqIds[0]]; return p === 'placed' ? 'placed' : p === 'notpart' ? 'notpart' : 'unclassified'; }
    if (row.kind === 'up' && E.typeOv[row.upId]) return 'changed';
    return dd ? (dd.v === 'accepted' ? 'accepted' : 'rejected') : 'proposed';
  }
  function passRows(key) {
    return cached(`ka:rows:${key}`, () => {
      const E = eff(key); if (!E) return []; const N = graph(key).N;
      const rows = E.I.rows.map((r) => {
        const state = rowState(r, E); const dd = E.dec[r.rowId] || null;
        const title = r.kind === 'up' ? `${N[r.upId].tag} · ${TYPE_BY_ID[E.typeOf[r.upId]].name}` : r.title;
        const actions = state === 'proposed' ? (r.kind === 'members' || r.kind === 'cg' ? ['accept', 'change', 'reject'] : r.kind === 'up' ? (E.I.ups.find((u) => u.id === r.upId).generic && !(stOf(key) || {}).confirmedAt ? ['accept', 'changeType'] : ['accept']) : ['accept']) : state === 'unclassified' ? ['place', 'notpart'] : state === 'notpart' ? ['place'] : [];
        return { ...r, title, state, stateLabel: { proposed: 'Proposed', accepted: 'Confirmed', changed: 'Changed', rejected: 'Rejected', placed: 'Placed', notpart: 'Not part of any unit process', unclassified: 'Unclassified' }[state], decided: state !== 'proposed' && state !== 'unclassified', decidedAt: dd ? dd.at : null, decidedBy: dd ? dd.by : null, note: dd && dd.note ? dd.note : null, actions };
      });
      /* equipment that lost every membership by a later edit is unclassified again, with a row of its own */
      const listed = new Set(rows.filter((r) => r.kind === 'unclassified').map((r) => r.eqIds[0]));
      Object.keys(E.placement).filter((id) => E.placement[id] === 'unclassified' && !listed.has(id)).forEach((id) => {
        const n = N[id]; rows.push({ rowId: `u:${id}`, kind: 'unclassified', group: 'unclassified', upId: null, cgId: null, title: `${n.tag} · ${n.name} · ${n.typeName}`, why: 'It takes part in no unit process since an edit removed it.', eqIds: [id], sensorIds: [], shared: false, alsoIn: [], state: 'unclassified', stateLabel: 'Unclassified', decided: false, decidedAt: null, decidedBy: null, note: null, actions: ['place', 'notpart'] });
      });
      return rows;
    });
  }
  const rowDecided = (r) => r.state !== 'proposed' && r.state !== 'unclassified';
  function structureDone(key) { const rows = passRows(key); return rows.length > 0 && rows.every(rowDecided); }

  function structurePass(key, opts) {
    const o = opts || {}; const show = o.show || o.filter || 'all';
    const E = eff(key); if (!E) return null; const rows = passRows(key); const N = graph(key).N; const st = stOf(key) || {};
    const keep = (r) => show === 'all' || (show === 'unclassified' && r.kind === 'unclassified' && r.state === 'unclassified') || (show === 'shared' && r.shared) || (show === 'cgs' && r.kind === 'cg');
    const groups = [];
    const un = rows.filter((r) => r.kind === 'unclassified' && r.state === 'unclassified');
    if (un.length && keep(un[0])) groups.push({ key: 'unclassified', title: 'Unclassified · no rule placed these', sub: 'Each one blocks go live until it is placed in a unit process or marked not part of any unit process.', rows: un.filter(keep), acceptCount: 0 });
    E.I.ups.forEach((u) => {
      const t = TYPE_BY_ID[E.typeOf[u.id]]; const upRow = rows.find((r) => r.rowId === `up:${u.id}`); const rs = rows.filter((r) => r.group === u.id && r.kind !== 'up');
      const shown = rs.filter(keep); if (show !== 'all' && !shown.length) return;
      groups.push({ key: u.id, upId: u.id, title: `${N[u.id].tag} · ${t.name}`, typeName: t.name, stageLabel: stageLabel(t.stage), sub: `Stage: ${stageLabel(t.stage)}`, why: u.why, generic: u.generic, state: upRow.state, stateLabel: upRow.stateLabel, upRow, rows: show === 'all' ? rs : shown, acceptCount: [upRow, ...rs].filter((r) => r.state === 'proposed').length });
    });
    const cgRows = rows.filter((r) => r.kind === 'cg'); if (cgRows.length && cgRows.some(keep)) groups.push({ key: 'cgs', title: 'Control groups · equipment that runs together under one setpoint', rows: cgRows.filter(keep), acceptCount: cgRows.filter((r) => r.state === 'proposed').length });
    const done = structureDone(key);
    const counts = { all: rows.length, proposed: rows.filter((r) => r.state === 'proposed').length, unclassified: un.length, shared: rows.filter((r) => r.shared).length, cgs: cgRows.length, decided: rows.filter(rowDecided).length, toReview: rows.filter((r) => !rowDecided(r)).length };
    const sc = summaryCounts(key, E);
    const banner = done && st.confirmedAt ? `Structure confirmed ${fmt(st.confirmedAt)} · ${sc.accepted} accepted${sc.placedByHand ? ` · ${sc.placedByHand} placed by hand` : ''}${sc.typesChanged ? ` · ${plural(sc.typesChanged, 'type')} changed` : ''}${sc.notPart ? ` · ${sc.notPart} not part of any unit process` : ''}` : null;
    return { plant: key, show, state: done ? 'confirmed' : 'open', done, groups, counts, banner, unclassified: un.map((r) => ({ eqId: r.eqIds[0], tag: N[r.eqIds[0]].tag, name: N[r.eqIds[0]].name })), confirmedAt: st.confirmedAt || null, runAt: st.runAt || null };
  }
  function summaryCounts(key, E) {
    const rows = passRows(key); const ovs = structOvs(key);
    return {
      accepted: rows.filter((r) => r.state === 'accepted').length,
      placedByHand: new Set(ovs.filter((o) => o.target.kind === 'member' && o.target.op === 'add').map((o) => o.target.eqId)).size,
      typesChanged: ovs.filter((o) => o.target.kind === 'uptype').length,
      notPart: Object.values(E.placement).filter((p) => p === 'notpart').length,
    };
  }

  function structure(key) {
    return cached(`ka:structure:${key}`, () => {
      const E = eff(key); if (!E) return null; const st = stOf(key) || {}; const d = dOf(key); const N = graph(key).N;
      const ups = unitProcesses(key); const cgs = controlGroups(key); const rows = passRows(key); const done = structureDone(key);
      const eqs = graph(key).nodes.filter((n) => !isAnchorCode(n.code)).map((n) => ({ eqId: n.id, tag: n.tag, placement: E.placement[n.id] }));
      const sc = summaryCounts(key, E);
      const sharedEq = Object.keys(E.byEq).filter((id) => E.byEq[id].length > 1);
      const counts = {
        nodes: d.equipment.length, ups: ups.length, equipment: eqs.length, sensors: d.sensors.length, memberships: E.mem.size, cgs: cgs.length,
        rows: rows.length, proposed: rows.filter((r) => r.state === 'proposed').length, unclassified: eqs.filter((x) => x.placement === 'unclassified').length,
        sharedEquipment: sharedEq.length, sharedRows: rows.filter((r) => r.shared).length, edits: structOvs(key).length, notPart: sc.notPart, placedByHand: sc.placedByHand, typesChanged: sc.typesChanged, accepted: sc.accepted,
      };
      return {
        plant: key, state: done ? 'confirmed' : 'open', done, readAt: st.readAt || null, runAt: st.runAt || null, runBy: st.runBy || null, confirmedAt: st.confirmedAt || null, confirmedBy: st.confirmedBy || null,
        ups, cgs, equipment: eqs, unclassified: eqs.filter((x) => x.placement === 'unclassified').map((x) => x.eqId), notPart: eqs.filter((x) => x.placement === 'notpart').map((x) => x.eqId),
        stages: STAGES.map((s) => ({ key: s.key, label: s.label, upIds: ups.filter((u) => (u.stage || null) === s.key).map((u) => u.id) })).filter((s) => s.upIds.length),
        counts, summary: `${plural(ups.length, 'unit process', 'unit processes')} · ${plural(eqs.length, 'piece', 'pieces')} of equipment · ${plural(cgs.length, 'control group')}`,
        tags: Object.fromEntries(Object.keys(N).map((id) => [id, N[id].tag])),
      };
    });
  }

  /* the Structure track on Readiness: what the survey wrote, what identification proposed, and the pass */
  function structureTrack(key) {
    const s = structure(key); const I = identify(key); if (!s || !I) return [];
    const base = `#/p/${key}`; const sc = s.counts;
    const passDetail = s.done
      ? [`Confirmed ${fmt(s.confirmedAt != null ? s.confirmedAt : now())}`, sc.placedByHand ? `${sc.placedByHand} placed by hand` : '', sc.typesChanged ? `${plural(sc.typesChanged, 'type')} changed` : '', sc.notPart ? `${sc.notPart} not part of any unit process` : ''].filter(Boolean).join(' · ')
      : [`${s.counts.rows - passRows(key).filter(rowDecided).length} to review`, sc.unclassified ? `${sc.unclassified} unclassified` : ''].filter(Boolean).join(' · ');
    const step = (id, state, label, detail, link, linkText) => ({ id, state, mark: state, label, detail, text: detail, link: link || null, action: link ? { label: linkText || 'Review', href: link } : null });
    return [
      step('survey', 'done', 'Survey complete', `Plant graph read ${fmt(s.readAt)}`),
      step('graph', 'done', 'Plant graph built', `${plural(sc.nodes, 'piece', 'pieces')} of equipment · ${plural(sc.sensors, 'sensor')}`),
      step('ident', 'done', 'Identification run', `${I.counts.ups} of them ${I.counts.ups === 1 ? 'is a unit process' : 'are unit processes'} · ${plural(I.counts.cgs, 'control group')}`),
      step('pass', s.done ? 'done' : 'current', 'Structure pass', passDetail, `${base}/review/structure`, 'Review'),
    ];
  }

  /* the bindings pass groups bindings by unit process in flow order: each piece of equipment once, under the first unit process
     it takes part in; the rest under "Outside any unit process" */
  function bindingGroups(key) {
    const E = eff(key); if (!E) return []; const N = graph(key).N; const seen = new Set(); const out = [];
    E.I.ups.forEach((u) => { const ids = [u.id, ...(E.byUp[u.id] || []).map((m) => m.eqId)].filter((id) => !seen.has(id)); ids.forEach((id) => seen.add(id)); out.push({ upId: u.id, title: `${N[u.id].tag} · ${TYPE_BY_ID[E.typeOf[u.id]].name}`, eqIds: ids }); });
    const rest = graph(key).nodes.filter((n) => !seen.has(n.id)).map((n) => n.id);
    out.push({ upId: null, title: 'Outside any unit process', eqIds: rest });
    return out;
  }

  /* ── the library: unit-process types ─────────────────────────────────────────────────────────── */
  const ORDER = __.ORDER;
  function upTypeTemplates(id) {
    const f = V.templates; if (typeof f !== 'function') return null;
    try { const all = f({}) || []; return all.filter((t) => t && ((t.owner && t.owner.kind === 'upType' && t.owner.id === id) || String(t.id || '').startsWith(`tpl_up_${id}_`))); } catch (e) { return null; }
  }
  function upType(id) {
    const t = TYPE_BY_ID[id]; if (!t) return null; const set = __.setOf(t.name) || { alerts: [], schedules: [] }; const cat = catByCode(t.contentFrom) || { sensors: [] };
    const plants = ORDER.filter((k) => dOf(k)).map((k) => { const E = eff(k); const n = E ? Object.keys(E.typeOf).filter((u) => E.typeOf[u] === id).length : 0; return { key: k, name: __.plantName(k), count: n }; }).filter((x) => x.count);
    const s = S(); const tv = s && s.lib && s.lib.typeVersions;
    return {
      id: t.id, name: t.name, stage: t.stage, stageLabel: stageLabel(t.stage), anchors: t.anchors.slice(), anchorNames: t.anchors.map(nameOfCode), generic: t.generic, flags: { bio: t.bio, filtration: t.filtration, settling: t.settling, ro: t.ro },
      contentFrom: t.contentFrom, contentFromName: contentFromName(t), expected: t.expected.slice(),
      readings: cat.sensors.map((x) => x.name), alerts: set.alerts.length, schedules: set.schedules.length, issues: __.issueTypes(t.name).length, generalTasks: C.tasksOf ? C.tasksOf(contentFromName(t)).length : 0,
      plants, plantCount: plants.length, count: plants.reduce((n, x) => n + x.count, 0), version: (tv && tv[`up:${id}`]) || 1, templates: upTypeTemplates(id),
      identifiedFrom: t.generic ? [...t.anchors.map(nameOfCode), 'a generic tank, from its place in the plant graph'] : t.anchors.map(nameOfCode), href: `#/library/up-types/${id}`,
    };
  }
  const upTypes = () => UP_TYPES.map((t) => upType(t.id));
  /* the unit-process types an equipment type's nodes become (its library page links to them) */
  const upTypesForCode = (code) => (GENERIC_TANKS.includes(code) ? UP_TYPES.filter((t) => t.generic).map((t) => t.id) : TYPE_BY_ANCHOR[code] ? [TYPE_BY_ANCHOR[code]] : []);
  const libKeyOf = (key, nodeId) => { const e = eqRaw(key, nodeId); return e ? e.libType || e.type : null; };
  const surveyCheck = (key) => ({ untyped: (dOf(key) ? dOf(key).equipment : []).filter((e) => e.notInDb).map((e) => ({ eqId: e.id, tag: e.tag, code: e.code })) });
  function issueTypesFor(key, ref) {
    const s = subjectOf(key, ref); if (!s || s.kind === 'plant') return [];
    return __.issueTypes(s.kind === 'up' ? (TYPE_BY_ID[eff(key).typeOf[s.id]] || {}).name : s.typeName);
  }

  /* what a unit-process type brings to one node: Triggers it can bind, Trigger templates that need sensors it lacks, Tasks, Issue types */
  function contentOf(key, upId, typeId) {
    const t = TYPE_BY_ID[typeId]; const e = eqRaw(key, upId); const set = __.setOf(t.name) || { alerts: [], schedules: [] };
    const have = new Set(dOf(key).sensors.filter((s) => s.on === 'eq:' + upId && !s.nextPhase).map((s) => s.name));
    const bind = set.alerts.filter((a) => have.has(a.sensorKind)); const need = set.alerts.filter((a) => !have.has(a.sensorKind));
    const rate = __.rateOfEq(e); const perDay = set.schedules.filter((x) => x.workType !== 'condition' && C.cadenceOf(x)).reduce((n, x) => n + 24 / __.intervalH(x, rate), 0);
    return { typeId, typeName: t.name, triggers: bind.length, tasks: set.schedules.length, issues: __.issueTypes(t.name).length, needSensor: need.length, needReadings: [...new Set(need.map((a) => a.sensorKind))], perDay };
  }
  function contentLine(c, tag) {
    const bits = [c.triggers ? plural(c.triggers, 'Trigger template') : '', c.tasks ? plural(c.tasks, 'Task template') : '', c.issues ? plural(c.issues, 'Issue type') : ''].filter(Boolean);
    const need = c.needSensor ? `${plural(c.needSensor, 'Trigger template')} ${c.needSensor === 1 ? 'needs a sensor' : 'need sensors'} ${tag} doesn't have${c.needReadings.length && c.needSensor <= 3 ? ` (${c.needReadings.join(', ')})` : ''}` : '';
    if (!bits.length && !need) return `${c.typeName} brings nothing to ${tag} yet.`;
    return `${c.typeName} brings ${bits.length ? joinAnd(bits) : 'no Task templates'}${need ? `; ${need}` : ''}.`;
  }

  /* ── the consequence of an edit, before saving (pure) ─────────────────────────────────────────── */
  function membershipPreview(key, changes) {
    const Ewas = eff(key); if (!Ewas) return null; const N = graph(key).N; const ch = (Array.isArray(changes) ? changes : changes ? [changes] : []).flatMap((c) => (c.op === 'place' ? (c.upIds || []).map((u) => ({ op: 'add', upId: u, eqId: c.eqId })) : [c]));
    const Ewill = build(key, ch);
    /* Triggers whose subject is a unit process or a piece of equipment the edit touches (a control-group edit moves nothing
       between unit processes, so no Trigger depends on it and none is flagged) */
    const touched = new Set(); ch.forEach((c) => { if (/^cg/.test(c.op || '')) return; if (c.upId) touched.add(c.upId); if (c.eqId) touched.add(c.eqId); (c.eqIds || []).forEach((x) => touched.add(x)); });
    const triggers = dOf(key).alerts.filter((a) => a.subject && touched.has(a.subject.id) && V.alertState(key, a.id) !== 'draft').map((a) => ({ alertId: a.id, name: triggerName(key, a) }));
    /* criticality tiers that move */
    const tiers = [];
    graph(key).nodes.filter((n) => !isAnchorCode(n.code)).forEach((n) => {
      const ov = ovTier(key, n.id); if (ov) return; const a = derivedTier(key, n.id, Ewas), b = derivedTier(key, n.id, Ewill);
      if (a.base !== b.base) tiers.push({ eqId: n.id, tag: n.tag, from: a.base, to: b.base });
    });
    const warnings = [];
    Object.keys(Ewill.placement).filter((id) => Ewill.placement[id] === 'unclassified' && Ewas.placement[id] !== 'unclassified').forEach((id) => warnings.push(`${N[id].tag} will be unclassified: it blocks go live until it is placed in a unit process or marked not part of any unit process.`));
    let content = null; const lines = [];
    const tc = ch.find((c) => c.op === 'type');
    if (tc) {
      const from = contentOf(key, tc.upId, Ewas.typeOf[tc.upId]), to = contentOf(key, tc.upId, tc.typeId); const tag = N[tc.upId].tag;
      content = { from, to, perDayDelta: to.perDay - from.perDay };
      lines.push(contentLine(to, tag)); lines.push(contentLine(from, tag));
      const dlt = to.perDay - from.perDay; lines.push(Math.abs(dlt) < 0.05 ? 'The same number of Tasks a day once Live.' : `About ${fmt1(Math.abs(dlt))} ${dlt > 0 ? 'more' : 'fewer'} Tasks a day once Live.`);
      if (triggers.length) lines.push(`${plural(triggers.length, 'Trigger')} re-checked: ${triggers.map((x) => x.name).join(', ')}`);
    } else {
      lines.push(triggers.length ? `${plural(triggers.length, 'Trigger')} re-checked: ${triggers.map((x) => x.name).join(', ')}` : 'No Trigger depends on this');
      if (tiers.length) tiers.forEach((x) => lines.push(`Criticality tier for ${x.tag}: ${x.from} → ${x.to}`)); else lines.push('criticality tiers unchanged');
    }
    warnings.forEach((w) => lines.push(w));
    const out = { triggers, tiers, warnings, lines, text: lines.join(' · ') }; if (content) out.content = content;
    return out;
  }

  /* ── actions ────────────────────────────────────────────────────────────────────────────────── */
  /* every action records how to put it back (undo), may finish the pass, flags Triggers on a Live plant, writes one Activity line */
  function newOverride(key, target, value, base, o) {
    const at = o.at != null ? o.at : now();
    const rec = { id: __.counterId('sseq', 'so'), plant: key, target, field: target.kind, value, base, baseSource: 'algorithm', baseOwner: null, baseVersion: null, reason: 'structure', note: o.note || '', author: o.author !== undefined ? o.author : ME, at, reviewBy: at + 365 * DAY, expires: null, status: 'active', endedAt: null, endedBy: null, endedNote: null, suspendedBy: null, variantRequest: null, history: [], algorithmSaid: o.said || '', linkSig: o.linkSig != null ? o.linkSig : '' };
    if (o.name) rec.name = o.name;
    S().overrides.push(rec); return rec;
  }
  function endOv(o, note, at) { const prev = { endedAt: o.endedAt, endedBy: o.endedBy, endedNote: o.endedNote, status: o.status }; o.endedAt = at != null ? at : now(); o.endedBy = ME; o.endedNote = note; o.status = 'reverted'; return prev; }
  /* each piece of equipment's tier before an action, so the Activity line can say which tiers the structure moved */
  const tierSnap = (key) => Object.fromEntries(graph(key).nodes.filter((n) => !isAnchorCode(n.code)).map((n) => [n.id, (tierInfo(key, n.id) || {}).value]));
  function startAction(key) { const st = ensureSt(key); return { key, st, ops: [], touches: new Set(), at: now(), tiers: tierSnap(key) }; }
  function setDecision(A, rowId, v, note) { const prev = A.st.decisions[rowId] || null; A.ops.push({ op: 'decision', rowId, prev }); A.st.decisions[rowId] = { v, at: A.at, by: ME, token: null, ...(note ? { note } : {}) }; A.touches.add(`row:${rowId}`); }
  function dropDecision(A, rowId) { const prev = A.st.decisions[rowId] || null; if (!prev) return; A.ops.push({ op: 'decision', rowId, prev }); delete A.st.decisions[rowId]; A.touches.add(`row:${rowId}`); }
  function addOv(A, target, value, base, o) { const r = newOverride(A.key, target, value, base, { ...o, at: A.at }); A.ops.push({ op: 'ovAdd', id: r.id }); return r; }
  function endOvA(A, rec, note) { const prev = endOv(rec, note, A.at); A.ops.push({ op: 'ovEnd', id: rec.id, prev }); }
  /* finish an action: undo entry, flags on a Live plant, the pass confirmed when it is done, Activity, save */
  function finish(A, label, opts) {
    const o = opts || {}; const key = A.key; const st = A.st;
    const token = __.counterId('useq', 'u');
    Object.keys(st.decisions).forEach((k) => { if (A.touches.has(`row:${k}`) && st.decisions[k] && st.decisions[k].at === A.at) st.decisions[k].token = token; });
    __.touch();
    let flagged = [];
    if (isLive(key) && o.affected && o.affected.length) {
      const set = new Set(o.affected);
      flagged = dOf(key).alerts.filter((a) => a.subject && set.has(a.subject.id) && V.alertState(key, a.id) !== 'draft');
      flagged.forEach((a) => { A.ops.push({ op: 'flag', alertId: a.id, prev: st.flags[a.id] || null }); st.flags[a.id] = { at: A.at, text: label, editId: token }; A.touches.add(`alert:${a.id}`); });
    }
    let confirmed = false;
    if (!st.confirmedAt && structureDone(key)) { A.ops.push({ op: 'confirm', prev: { confirmedAt: st.confirmedAt, confirmedBy: st.confirmedBy } }); st.confirmedAt = A.at; st.confirmedBy = ME; confirmed = true; }
    if (o.tiers !== false) syncTiers(key);
    const E = eff(key); const I = E.I; const sc = summaryCounts(key, E);
    const after = tierSnap(key); const moved = Object.keys(after).filter((id) => A.tiers[id] && after[id] && A.tiers[id] !== after[id]).sort((a, b) => byTag(tagOf(key, a), tagOf(key, b))).map((id) => ({ eqId: id, tag: tagOf(key, id), from: A.tiers[id], to: after[id] }));
    const live = isLive(key);
    let text = label + (o.note ? (live ? ` · Reason: ${o.note}` : ` · ${o.note}`) : '');
    if (live && flagged.length) text += ` · ${plural(flagged.length, 'Trigger')} flagged: ${flagged.map((a) => triggerName(key, a)).join(', ')}`;
    moved.forEach((x) => { text += ` · Criticality tier for ${x.tag}: ${x.from} → ${x.to}`; });
    __.addActivity({ at: A.at, plant: key, text, kind: 'structure', undoToken: token });
    let toast = o.toast || label;
    if (confirmed) {
      const ups = I.ups.length, cgs = E.cgs.filter((c) => c.state !== 'rejected').length;
      __.addActivity({ at: A.at, plant: key, text: `Structure confirmed: ${plural(ups, 'unit process', 'unit processes')}, ${plural(cgs, 'control group')}; ${plural(sc.accepted, 'proposal')} accepted, ${plural(sc.typesChanged, 'type')} changed, ${plural(sc.placedByHand, 'piece', 'pieces')} of equipment placed by hand, ${sc.notPart} marked not part of any unit process. The bindings pass is open`, kind: 'structure', undoToken: token });
      toast = `Structure confirmed: ${plural(ups, 'unit process', 'unit processes')}, ${plural(cgs, 'control group')}. The bindings pass is open`;
    }
    st.undo.push({ token, at: A.at, plant: key, ops: A.ops, label, touches: [...A.touches], undone: false });
    if (st.undo.length > 20) st.undo = st.undo.slice(-20);
    __.touch(); __.persist();
    return { ok: true, token, toast, confirmed, flagged: flagged.map((a) => a.id), tiers: moved };
  }
  const rowById = (key, rowId) => passRows(key).find((r) => r.rowId === rowId) || null;

  function acceptStructure(key, sel, opts) {
    const o = { ...(sel || {}), ...(opts || {}) }; const E = eff(key); if (!E) return { ok: false, error: 'No such plant.' };
    const bad = needNote(key, o.note); if (bad) return bad;
    let rows = passRows(key).filter((r) => r.state === 'proposed');
    if (o.all) { /* every proposed row */ }
    else if (o.upId) rows = rows.filter((r) => r.upId === o.upId && r.kind !== 'cg');
    else if (o.rowIds) { const ids = new Set([].concat(o.rowIds)); rows = rows.filter((r) => ids.has(r.rowId)); }
    else return { ok: false, error: 'Choose what to accept.' };
    if (!rows.length) return { ok: false, error: 'Nothing left to accept here.' };
    const A = startAction(key); rows.forEach((r) => setDecision(A, r.rowId, 'accepted'));
    const N = graph(key).N; const upTag = o.upId ? N[o.upId].tag : null;
    const label = o.all ? `Structure pass: accepted ${plural(rows.length, 'proposal')}` : upTag ? `Structure pass: accepted ${rows.length} for ${upTag}` : rows.length === 1 ? `Structure pass: accepted ${rows[0].title}${rows[0].upId && rows[0].kind !== 'up' ? ` for ${N[rows[0].upId].tag}` : ''}` : `Structure pass: accepted ${plural(rows.length, 'proposal')}`;
    const r = finish(A, label, { note: o.note, toast: upTag ? `Accepted ${rows.length} for ${upTag}` : `Accepted ${rows.length}`, tiers: false });
    return { ...r, count: rows.length };
  }
  function rejectStructure(key, rowId, opts) {
    const o = opts || {}; const row = rowById(key, rowId); if (!row) return { ok: false, error: 'No such proposal.' };
    const bad = needNote(key, o.note); if (bad) return bad;
    if (row.kind === 'up') return { ok: false, error: 'A unit process can\'t be rejected: change its type, or correct the survey, then re-run identification.' };
    if (row.kind === 'readings') return { ok: false, error: 'Sensors move with the plant graph: correct the survey, then re-run identification.' };
    if (row.kind === 'unclassified') return { ok: false, error: 'Place it in a unit process, or mark it not part of any unit process.' };
    if (row.state !== 'proposed') return { ok: false, error: 'This proposal is already decided.' };
    const E = eff(key); const N = graph(key).N; const A = startAction(key); let label, affected = [];
    if (row.kind === 'members') {
      row.eqIds.forEach((eqId) => { const m = E.mem.get(`${row.upId}|${eqId}`); if (!m) return; addOv(A, { kind: 'member', upId: row.upId, eqId, op: 'remove' }, false, 'proposed', { note: o.note, said: `Proposed: ${m.why}`, linkSig: linkSigOf(key, eqId) }); A.touches.add(`eq:${eqId}`); });
      A.touches.add(`up:${row.upId}`); affected = [row.upId, ...row.eqIds];
      label = `Structure pass: rejected ${row.title} for ${N[row.upId].tag}`;
    } else {
      const c = E.cgs.find((x) => x.id === row.cgId); addOv(A, { kind: 'cg', cgId: row.cgId, op: 'reject' }, null, c ? c.memberIds.slice() : null, { note: o.note, said: `Proposed: ${c ? c.name : row.cgId} (${tagsOf(key, c ? c.memberIds : []).join(', ')})`, linkSig: '' });
      A.touches.add(`cg:${row.cgId}`); label = `Control group ${c ? c.name : row.cgId} rejected`;
    }
    setDecision(A, rowId, 'rejected', o.note || null);
    return finish(A, label, { note: o.note, affected });
  }
  function upTypeOptions(key, upId) {
    const E = eff(key); if (!E) return []; const u = E.I.ups.find((x) => x.id === upId); if (!u) return [];
    const cur = E.typeOf[upId]; const opt = (t) => ({ id: t.id, name: t.name, stage: t.stage, stageLabel: stageLabel(t.stage), proposed: t.id === u.typeId, current: t.id === cur });
    if (!u.generic) return [opt(TYPE_BY_ID[u.typeId])];
    const rest = UP_TYPES.filter((t) => t.id !== u.typeId).sort((a, b) => STAGES.findIndex((s) => s.key === a.stage) - STAGES.findIndex((s) => s.key === b.stage));
    return [opt(TYPE_BY_ID[u.typeId]), ...rest.map(opt)];
  }
  function changeUpType(key, upId, typeId, opts) {
    const o = opts || {}; const E = eff(key); if (!E) return { ok: false, error: 'No such plant.' }; const u = E.I.ups.find((x) => x.id === upId); if (!u) return { ok: false, error: 'No such unit process.' };
    const t = TYPE_BY_ID[typeId]; if (!t) return { ok: false, error: 'No such unit-process type.' };
    const st = ensureSt(key); if (st.confirmedAt) return { ok: false, error: 'The structure is confirmed. Changing a unit process\'s type re-proposes its bindings, which this study doesn\'t do.' };
    const bad = needNote(key, o.note); if (bad) return bad;
    const e = eqRaw(key, upId);
    if (!u.generic && typeId !== u.typeId) return { ok: false, error: `${e.tag} is ${TYPE_BY_ID[u.typeId].name} because the survey stores it as ${e.type}. Correct the survey, then re-run identification.` };
    if (E.typeOf[upId] === typeId) return { ok: false, error: `${e.tag} is already ${t.name}.` };
    const preview = membershipPreview(key, [{ op: 'type', upId, typeId }]);
    const A = startAction(key); const fromName = TYPE_BY_ID[E.typeOf[upId]].name;
    const prevOv = E.typeOv[upId]; if (prevOv) endOvA(A, prevOv, `Type changed to ${t.name}`);
    if (typeId !== u.typeId) addOv(A, { kind: 'uptype', upId }, typeId, u.typeId, { note: o.note, said: `Proposed: ${TYPE_BY_ID[u.typeId].name}`, linkSig: linkSigOf(key, upId) });
    A.ops.push({ op: 'libType', eqId: upId, prev: e.libType || null }); e.libType = t.name;
    if (!(A.st.decisions[`up:${upId}`] && A.st.decisions[`up:${upId}`].v === 'accepted')) setDecision(A, `up:${upId}`, 'accepted');
    A.touches.add(`up:${upId}`); A.touches.add(`row:up:${upId}`);
    const label = `${e.tag} is now ${t.name}${typeId === u.typeId ? ' (as proposed)' : ` (proposed as ${TYPE_BY_ID[u.typeId].name})`}`;
    const r = finish(A, label, { note: o.note, toast: `${e.tag} is now ${t.name}`, affected: [upId] });
    return { ...r, from: fromName, to: t.name, preview };
  }
  const asList = (x) => [].concat(x == null ? [] : x);
  function place(key, eqIds, upIds, opts) {
    const o = opts || {}; const ids = asList(eqIds); const ups = asList(upIds); const E = eff(key); if (!E) return { ok: false, error: 'No such plant.' };
    if (!ids.length) return { ok: false, error: 'Choose the equipment to place.' };
    if (!ups.length) return { ok: false, error: 'Choose at least one unit process.' };
    for (const id of ids) { if (!eqRaw(key, id)) return { ok: false, error: 'No such equipment.' }; if (isUp(key, id)) return { ok: false, error: `${tagOf(key, id)} is a unit process: it can't take part in another one.` }; }
    for (const u of ups) if (!isUp(key, u)) return { ok: false, error: 'Place it in a unit process.' };
    const bad = needNote(key, o.note); if (bad) return bad;
    const preview = membershipPreview(key, ids.flatMap((id) => ups.map((u) => ({ op: 'add', upId: u, eqId: id }))));
    const A = startAction(key); let n = 0;
    ids.forEach((id) => {
      ups.forEach((u) => {
        const k = `${u}|${id}`; if (E.mem.has(k)) return;
        const rem = E.removed.find((m) => m.upId === u && m.eqId === id && m.overrideId); const recR = rem ? S().overrides.find((x) => x.id === rem.overrideId) : null;
        if (recR) endOvA(A, recR, 'Put back'); else addOv(A, { kind: 'member', upId: u, eqId: id, op: 'add' }, true, 'not proposed', { note: o.note, said: E.I.unclassified.some((x) => x.eqId === id) ? 'Unclassified: no rule matches' : `Not proposed in ${tagOf(key, u)}`, linkSig: linkSigOf(key, id) });
        n++; A.touches.add(`up:${u}`);
      });
      A.touches.add(`eq:${id}`); A.touches.add(`row:u:${id}`);
      if (A.st.decisions[`u:${id}`]) dropDecision(A, `u:${id}`);
    });
    if (!n) return { ok: false, error: 'Already there: nothing to place.' };
    const label = `${joinAnd(tagsOf(key, ids))} placed in ${joinAnd(tagsOf(key, ups))}`;
    const r = finish(A, label, { note: o.note, affected: [...ids, ...ups] });
    return { ...r, count: n, preview };
  }
  function notPart(key, eqIds, opts) {
    const o = opts || {}; const ids = asList(eqIds); const E = eff(key); if (!E) return { ok: false, error: 'No such plant.' };
    if (!ids.length) return { ok: false, error: 'Choose the equipment.' };
    for (const id of ids) {
      if (!eqRaw(key, id)) return { ok: false, error: 'No such equipment.' };
      if (isUp(key, id)) return { ok: false, error: `${tagOf(key, id)} is a unit process.` };
      if ((E.byEq[id] || []).length) return { ok: false, error: `${tagOf(key, id)} takes part in ${joinAnd(E.byEq[id].map((m) => tagOf(key, m.upId)))}: remove it there first.` };
    }
    const bad = needNote(key, o.note); if (bad) return bad;
    const todo = ids.filter((id) => E.placement[id] !== 'notpart'); if (!todo.length) return { ok: false, error: 'Already marked not part of any unit process.' };
    const A = startAction(key); todo.forEach((id) => { setDecision(A, `u:${id}`, 'notpart', o.note || null); A.touches.add(`eq:${id}`); });
    const label = `${joinAnd(tagsOf(key, todo))} marked not part of any unit process`;
    const r = finish(A, label, { note: o.note, affected: todo });
    return { ...r, count: todo.length };
  }
  function editMembers(key, changes, opts) {
    const o = opts || {}; const ch = asList(changes); const E = eff(key); if (!E) return { ok: false, error: 'No such plant.' };
    if (!ch.length) return { ok: false, error: 'Nothing to save.' };
    for (const c of ch) { if ((c.op !== 'add' && c.op !== 'remove') || !isUp(key, c.upId) || !eqRaw(key, c.eqId) || isUp(key, c.eqId)) return { ok: false, error: 'Add or remove a piece of equipment on a unit process.' }; }
    const bad = needNote(key, o.note); if (bad) return bad;
    const preview = membershipPreview(key, ch);
    const A = startAction(key); const adds = {}, rems = {};
    ch.forEach((c) => {
      const k = `${c.upId}|${c.eqId}`; const m = E.mem.get(k);
      if (c.op === 'add') {
        if (m) return; const rem = E.removed.find((x) => x.upId === c.upId && x.eqId === c.eqId && x.overrideId); const recR = rem ? S().overrides.find((x) => x.id === rem.overrideId) : null;
        if (recR) endOvA(A, recR, 'Put back'); else addOv(A, { kind: 'member', upId: c.upId, eqId: c.eqId, op: 'add' }, true, 'not proposed', { note: o.note, said: E.I.unclassified.some((x) => x.eqId === c.eqId) ? 'Unclassified: no rule matches' : `Not proposed in ${tagOf(key, c.upId)}`, linkSig: linkSigOf(key, c.eqId) });
        (adds[c.upId] = adds[c.upId] || []).push(c.eqId); if (A.st.decisions[`u:${c.eqId}`]) dropDecision(A, `u:${c.eqId}`);
      } else {
        if (!m) return;
        if (m.state === 'added' && m.overrideId) { const rec = S().overrides.find((x) => x.id === m.overrideId); if (rec) endOvA(A, rec, 'Removed again'); }
        else addOv(A, { kind: 'member', upId: c.upId, eqId: c.eqId, op: 'remove' }, false, 'proposed', { note: o.note, said: `Proposed: ${m.why}`, linkSig: linkSigOf(key, c.eqId) });
        (rems[c.upId] = rems[c.upId] || []).push(c.eqId);
      }
      A.touches.add(`up:${c.upId}`); A.touches.add(`eq:${c.eqId}`);
    });
    if (!A.ops.length) return { ok: false, error: 'Nothing changed: each one is already there.' };
    const bits = [...Object.keys(adds).map((u) => `${tagsOf(key, adds[u]).join(', ')} added to ${tagOf(key, u)}`), ...Object.keys(rems).map((u) => `${tagsOf(key, rems[u]).join(', ')} removed from ${tagOf(key, u)}`)];
    const label = bits.join('; ');
    const r = finish(A, label, { note: o.note, toast: `Saved · ${label}`, affected: ch.flatMap((c) => [c.upId, c.eqId]) });
    return { ...r, preview };
  }
  const cgCodes = [...BLOWERS, ...PUMPS, ...DOSING_PUMP];
  function makeControlGroup(key, eqIds, opts) {
    const o = opts || {}; const ids = [...new Set(asList(eqIds))]; const E = eff(key); if (!E) return { ok: false, error: 'No such plant.' };
    if (ids.length < 2) return { ok: false, error: 'A control group needs at least two members.' };
    for (const id of ids) { const e = eqRaw(key, id); if (!e) return { ok: false, error: 'No such equipment.' }; if (!cgCodes.includes(codeOf(e))) return { ok: false, error: `${e.tag} is not a blower or a pump: only those run together under one setpoint.` }; }
    const inOther = ids.find((id) => (E.cgOf[id] || []).length); if (inOther) { const c0 = E.cgs.find((c) => c.id === E.cgOf[inOther][0]); return { ok: false, error: `${tagOf(key, inOther)} already runs in ${c0 ? c0.name : 'another control group'}: take it out there first.` }; }
    const bad = needNote(key, o.note); if (bad) return bad;
    const sorted = sortIds(key, ids); let cgId = `cg_${tagOf(key, sorted[0]).toLowerCase()}`; let k = 2; while (E.cgs.some((c) => c.id === cgId)) cgId = `cg_${tagOf(key, sorted[0]).toLowerCase()}-${k++}`;
    const name = String(o.name || '').trim() || pluralName(stemOf((eqRaw(key, sorted[0]) || {}).name || 'Control group'));
    const A = startAction(key); addOv(A, { kind: 'cg', cgId, op: 'make' }, sorted, null, { note: o.note, said: 'Not proposed', linkSig: '', name });
    A.touches.add(`cg:${cgId}`); sorted.forEach((id) => A.touches.add(`eq:${id}`));
    const r = finish(A, `Control group made: ${name} (${tagsOf(key, sorted).join(', ')})`, { note: o.note, toast: `Control group made: ${name}`, tiers: false });
    return { ...r, cgId };
  }
  function editControlGroup(key, cgId, change, opts) {
    const o = opts || {}; const ch = change || {}; const E = eff(key); if (!E) return { ok: false, error: 'No such plant.' };
    const c = E.cgs.find((x) => x.id === cgId); if (!c || c.state === 'rejected') return { ok: false, error: 'No such control group.' };
    const add = asList(ch.add).filter((id) => !c.memberIds.includes(id)); const rem = asList(ch.remove).filter((id) => c.memberIds.includes(id));
    if (!add.length && !rem.length) return { ok: false, error: 'Nothing to save.' };
    for (const id of add) { const e = eqRaw(key, id); if (!e || !cgCodes.includes(codeOf(e))) return { ok: false, error: `${e ? e.tag : id} is not a blower or a pump: only those run together under one setpoint.` }; }
    const inOther = add.find((id) => (E.cgOf[id] || []).some((x) => x !== cgId)); if (inOther) { const c0 = E.cgs.find((x) => x.id === E.cgOf[inOther].find((y) => y !== cgId)); return { ok: false, error: `${tagOf(key, inOther)} already runs in ${c0 ? c0.name : 'another control group'}: take it out there first.` }; }
    const next = sortIds(key, c.memberIds.filter((id) => !rem.includes(id)).concat(add)); if (next.length < 2) return { ok: false, error: 'A control group needs at least two members.' };
    const bad = needNote(key, o.note); if (bad) return bad;
    const A = startAction(key); const prev = c.overrideId ? S().overrides.find((x) => x.id === c.overrideId) : null;
    if (c.made) { if (prev) endOvA(A, prev, 'Members changed'); addOv(A, { kind: 'cg', cgId, op: 'make' }, next, null, { note: o.note, said: 'Not proposed', linkSig: '', name: c.name }); }
    else {
      if (prev) endOvA(A, prev, 'Members changed');
      const same = next.length === c.proposedMemberIds.length && next.every((id) => c.proposedMemberIds.includes(id));
      if (!same) addOv(A, { kind: 'cg', cgId, op: 'edit' }, next, c.proposedMemberIds.slice(), { note: o.note, said: `Proposed: ${tagsOf(key, c.proposedMemberIds).join(', ')}`, linkSig: '' });
    }
    A.touches.add(`cg:${cgId}`); [...add, ...rem].forEach((id) => A.touches.add(`eq:${id}`));
    const label = `Control group ${c.name}: ${[add.length ? `added ${tagsOf(key, add).join(', ')}` : '', rem.length ? `removed ${tagsOf(key, rem).join(', ')}` : ''].filter(Boolean).join(', ')}`;
    return finish(A, label, { note: o.note, tiers: false });
  }

  /* undo: one action, while no later action touched the same rows */
  function undoEntry(key, token) { const st = stOf(key); if (!st) return { st: null, i: -1 }; const i = st.undo.findIndex((u) => u.token === token); return { st, i }; }
  /* the action that confirmed the structure opened the bindings pass; once anything there was decided, undoing it would leave
     decided bindings behind a reopened structure pass, so it is no longer offered */
  function bindingsWorkedSince(key, at) {
    const P = PS(key); if (!P) return false;
    if (Object.values(P.alerts || {}).some((r) => r && r.since != null && r.since >= at)) return true;
    if (Object.values(P.decisions || {}).some((x) => x && x.at != null && x.at >= at)) return true;
    const f = V.bindingsPass; const bp = typeof f === 'function' ? (() => { try { return f(key); } catch (e) { return null; } })() : null;
    const c = bp && bp.counts; return !!c && ((c.active || 0) + (c.drafts || 0) + (c.inactive || 0) + (c.rejected || 0)) > 0;
  }
  function undoBlock(key, token) {
    const { st, i } = undoEntry(key, token); if (!st || i < 0) return 'Nothing to undo.'; const u = st.undo[i]; if (u.undone) return 'This is already undone.';
    const mine = new Set(u.touches); if (st.undo.slice(i + 1).some((x) => !x.undone && x.touches.some((t) => mine.has(t)))) return 'This can no longer be undone: a later change touched the same rows.';
    if (u.ops.some((op) => op.op === 'confirm') && bindingsWorkedSince(key, u.at)) return 'This can no longer be undone: the bindings pass has been worked since the structure was confirmed.';
    return null;
  }
  const canUndo = (key, token) => !undoBlock(key, token);
  function undoStructure(key, token) {
    const why = undoBlock(key, token); if (why) return { ok: false, error: why };
    const { st, i } = undoEntry(key, token); const u = st.undo[i];
    u.ops.slice().reverse().forEach((op) => {
      if (op.op === 'decision') { if (op.prev) st.decisions[op.rowId] = op.prev; else delete st.decisions[op.rowId]; }
      else if (op.op === 'ovAdd') { S().overrides = S().overrides.filter((x) => x.id !== op.id); }
      else if (op.op === 'ovEnd') { const r = S().overrides.find((x) => x.id === op.id); if (r) Object.assign(r, op.prev); }
      else if (op.op === 'libType') { const e = eqRaw(key, op.eqId); if (e) { if (op.prev) e.libType = op.prev; else delete e.libType; } }
      else if (op.op === 'confirm') { st.confirmedAt = op.prev.confirmedAt; st.confirmedBy = op.prev.confirmedBy; }
      else if (op.op === 'flag') { if (op.prev) st.flags[op.alertId] = op.prev; else delete st.flags[op.alertId]; }
    });
    u.undone = true; __.touch(); syncTiers(key);
    __.addActivity({ at: now(), plant: key, text: `Undone: ${u.label}`, kind: 'structure' });
    __.touch(); __.persist();
    return { ok: true, toast: `Undone: ${u.label}` };
  }

  /* re-running identification on the same plant graph changes nothing and keeps every decision and edit */
  function rerunIdentification(key) {
    const st = ensureSt(key); __.touch(); const I = identify(key); if (!I) return { ok: false, error: 'No such plant.' };
    const cur = rowSigs(I); const prev = st.sig || {};
    const changed = Object.keys(cur).filter((id) => id in prev && prev[id] !== cur[id]); const added = Object.keys(cur).filter((id) => !(id in prev)); const gone = Object.keys(prev).filter((id) => !(id in cur));
    const kept = Object.keys(cur).length - changed.length - added.length;
    const nd = Object.keys(st.decisions).length, ne = structOvs(key).length;
    st.sig = cur; st.runAt = now(); st.runBy = ME;
    const same = !changed.length && !added.length && !gone.length;
    const text = same ? `Identification re-run: nothing changed in the plant graph. Your ${plural(nd, 'decision')} and ${plural(ne, 'edit')} are kept.` : `Identification re-run: ${changed.length} changed, ${added.length} new, ${gone.length} gone. Your ${plural(nd, 'decision')} and ${plural(ne, 'edit')} are kept; check the changed rows.`;
    __.addActivity({ at: now(), plant: key, text: same ? `Identification re-run: nothing changed in the plant graph; ${plural(nd, 'decision')} and ${plural(ne, 'edit')} kept` : text, kind: 'structure' });
    __.touch(); __.persist();
    return { ok: true, changed, added, gone, kept, text };
  }

  /* the flag a structure change on a Live plant leaves on the Triggers it touched, until a person marks them checked */
  function structureFlag(key, alertId) {
    const st = stOf(key); const f = st && st.flags ? st.flags[alertId] : null; if (!f) return null;
    return { ...f, line: `Structure changed ${fmt(f.at)}: ${f.text}. Nothing in this Trigger's terms changed.` };
  }
  function clearStructureFlag(key, alertId) {
    const st = stOf(key); if (!st || !st.flags || !st.flags[alertId]) return { ok: false, error: 'Nothing to mark: this Trigger has no structure change waiting.' };
    delete st.flags[alertId]; const a = __.alertRaw(key, alertId);
    __.addActivity({ at: now(), plant: key, text: `Structure change checked on ${a ? triggerName(key, a) : alertId}`, kind: 'structure' });
    __.touch(); __.persist(); return { ok: true };
  }

  /* the structure changes in the ledger, in words (for Deviations and the unit-process page) */
  function structureChange(o) {
    const key = o.plant; const t = o.target || {}; const tg = (id) => tagOf(key, id); const E = eff(key);
    let upId = t.upId || null, eqId = t.eqId || null, what = '', detail = '', href = `#/p/${key}/structure`;
    if (t.kind === 'member') { what = t.op === 'remove' ? `${tg(eqId)} removed` : `${tg(eqId)} added`; detail = t.op === 'remove' ? 'Removed · was proposed' : 'Added · not proposed'; href += `?select=up:${upId}`; }
    else if (t.kind === 'uptype') { const to = TYPE_BY_ID[o.value], from = TYPE_BY_ID[o.base]; what = `type ${from ? from.name : o.base} → ${to ? to.name : o.value}`; detail = `Type changed · proposed as ${from ? from.name : o.base}`; href += `?select=up:${upId}`; }
    else if (t.kind === 'cg') { const c = E && E.cgs.find((x) => x.id === t.cgId); const nm = o.name || (c ? c.name : t.cgId); what = t.op === 'make' ? `control group ${nm} made (${tagsOf(key, o.value || []).join(', ')})` : t.op === 'reject' ? `control group ${nm} rejected` : `control group ${nm}: ${tagsOf(key, o.value || []).join(', ')}`; detail = t.op === 'make' ? 'Control group · not proposed' : t.op === 'reject' ? 'Control group · rejected' : 'Control group · changed'; href += `?select=cg:${t.cgId}`; }
    const underneath = (t.kind === 'member' || t.kind === 'uptype') && o.linkSig != null && o.linkSig !== linkSigOf(key, t.kind === 'member' ? eqId : upId);
    return { id: o.id, plant: key, kind: t.kind, op: t.op || null, upId, upTag: upId ? tg(upId) : null, eqId, tag: eqId ? tg(eqId) : null, cgId: t.cgId || null, what, detail, line: `${upId ? tg(upId) + ' · ' : ''}${what}`, note: o.note || '', author: o.author, at: o.at, reviewBy: o.reviewBy, algorithmSaid: o.algorithmSaid || '', underneath, href, active: ovLive(o) };
  }
  const structureChanges = (opts) => { const o = opts || {}; return (S() ? S().overrides : []).filter((x) => x.target && STRUCT_KINDS.includes(x.target.kind) && (!o.plant || x.plant === o.plant) && (o.all || ovLive(x))).map(structureChange); };

  /* ── the drawing (the real plant graph only) ───────────────────────────────────────────────────── */
  function drawing(key) {
    return cached(`ka:drawing:${key}`, () => {
      const lay = (window.SCADA_LAYOUTS || {})[key]; const smp = (window.SCADA_SAMPLES || {})[key]; const meta = __.PLANT_META[key];
      if (!lay || !smp || !meta || !meta.realLayout) return null;
      const cells = (lay.layout || lay).cells || []; const byCell = {}; cells.forEach((c) => { byCell[c.id] = c; });
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const grow = (c) => { x0 = Math.min(x0, c.position.x); y0 = Math.min(y0, c.position.y); x1 = Math.max(x1, c.position.x + c.size.width); y1 = Math.max(y1, c.position.y + c.size.height); };
      const E = eff(key);
      const nodes = smp.equipment.filter((se) => byCell[se.cell] && eqRaw(key, se.id)).map((se) => {
        const c = byCell[se.cell]; grow(c); const e = eqRaw(key, se.id); const up = isUp(key, se.id);
        return { id: se.id, tag: e.tag, kind: up ? 'up' : 'eq', typeName: up && E ? TYPE_BY_ID[E.typeOf[se.id]].name : e.type, x: c.position.x, y: c.position.y, w: c.size.width, h: c.size.height };
      });
      const points = cells.filter((c) => c.type === 'ZONE').map((c) => { grow(c); return { label: (c.attrs && c.attrs.label && c.attrs.label.text) || '', x: c.position.x, y: c.position.y, w: c.size.width, h: c.size.height }; });
      return { viewBox: [x0 - 40, y0 - 40, x1 - x0 + 80, y1 - y0 + 80], zoom: 0.25, nodes, links: graph(key).links.map(([a, b]) => [a, b]), points };
    });
  }

  /* ── subjects in the engine: an Issue takes its Trigger's subject; diagnosis names the cause from the structure ─────── */
  __.hook('issueSubject', (key, alert) => { const s = subjectOf(key, alert && alert.subject ? alert.subject.id : null); return s ? { kind: s.kind, id: s.id } : { kind: 'eq', id: alert && alert.subject ? alert.subject.id : null }; });
  function subjectOfIssue(key, iss) {
    if (iss.subject && iss.subject.kind) return subjectOf(key, iss.subject);
    if (iss.alertId) { const a = __.alertRaw(key, iss.alertId); if (a && a.subject) return subjectOf(key, a.subject.id); }
    return iss.eqId ? subjectOf(key, iss.eqId) : subjectOf(key, { kind: 'plant' });
  }
  /* Once a root cause is found: on a unit process, a participant of the cause's machine types (the basin's own type set aside);
     on equipment, equipment of those types sharing a unit process with it; else any of those types at the plant. Running first. */
  function causeCandidates(key, iss, c) {
    const types = (c && c.types) || []; if (!types.length) return null;
    const subj = subjectOfIssue(key, iss); if (!subj || subj.kind === 'plant') return null;
    const E = eff(key); const d = dOf(key); const run = (list) => list.filter((x) => x.status === 'running').concat(list.filter((x) => x.status !== 'running'));
    const node = eqRaw(key, subj.id); let rest = types;
    const anyAtPlant = (excl) => run(d.equipment.filter((x) => rest.includes(x.type) && !isUp(key, x.id) && !excl.includes(x.id))).map((x) => ({ eqId: x.id, text: `Caused by ${x.tag} (${x.type} at this plant)` }));
    if (subj.kind === 'up') {
      const t = TYPE_BY_ID[E.typeOf[subj.id]]; const own = [node.type, t ? contentFromName(t) : null].filter(Boolean);
      rest = types.filter((x) => !own.includes(x)); if (!rest.length) return null;
      const parts = run((E.byUp[subj.id] || []).map((m) => eqRaw(key, m.eqId)).filter((x) => x && rest.includes(x.type)));
      if (parts.length) return parts.map((x) => ({ eqId: x.id, text: `Caused by ${x.tag} (${x.type}; takes part in ${node.tag})` }));
      const any = anyAtPlant([]); return any.length ? any : null;
    }
    if (types.includes(node.type)) return null;
    const ups = (E.byEq[node.id] || []).map((m) => m.upId); const out = [];
    ups.forEach((u) => run((E.byUp[u] || []).map((m) => eqRaw(key, m.eqId)).filter((x) => x && x.id !== node.id && rest.includes(x.type))).forEach((x) => { if (!out.some((y) => y.eqId === x.id)) out.push({ eqId: x.id, text: `Caused by ${x.tag} (${x.type}; shares ${tagOf(key, u)})`, _r: x.status === 'running' }); }));
    if (out.length) return out.filter((x) => x._r).concat(out.filter((x) => !x._r)).map(({ _r, ...x }) => x);
    const any = anyAtPlant([node.id]); return any.length ? any : null;
  }
  __.hook('causeCandidates', causeCandidates);

  /* ── views, decorated: every node, Trigger, Issue and Task knows its subject ──────────────────── */
  __.decorate('eq', (v, key) => {
    if (!dOf(key) || !graph(key)) return v; const up = isUp(key, v.id); const s = subjectOf(key, v.id); const m = up ? null : membershipOf(key, v.id); const t = up ? upTypeOf(key, v.id) : null;
    return { ...v, kind: up ? 'up' : 'eq', subject: s, upTypeId: t ? t.id : null, upTypeName: t ? t.name : null, stage: t ? t.stage : null, stageLabel: t ? stageLabel(t.stage) : null, participatesIn: m ? m.participatesIn : [], controlGroups: m ? m.controlGroups : [], placement: m ? m.placement : null, href: s ? s.href : v.href };
  });
  __.decorate('alert', (v, key) => {
    const node = v.eqId; const s = node ? subjectOf(key, node) : null;
    const out = { ...v, subject: s, upId: s && s.kind === 'up' ? s.id : null, subjectText: s ? s.text : null, structureFlag: structureFlag(key, v.id) };
    if (s && s.kind === 'up') out.eqId = null;
    return out;
  });
  __.decorate('issue', (v, key) => { const s = subjectOfIssue(key, v); return { ...v, subject: s, upId: s && s.kind === 'up' ? s.id : null }; });
  __.decorate('task', (v, key) => { const s = v.plantLevel || !v.eqIds || !v.eqIds.length ? subjectOf(key, { kind: 'plant' }) : subjectOf(key, v.eqIds[0]); return { ...v, subject: s, upId: s && s.kind === 'up' ? s.id : null }; });
  __.decorate('plant', (v, key) => {
    const s = structure(key); if (!s) return v;
    return { ...v, nodeCount: s.counts.nodes, upCount: s.counts.ups, equipmentCount: s.counts.equipment, cgCount: s.counts.cgs, unclassified: s.counts.unclassified, structureDone: s.done, structureState: s.state };
  });

  /* ── public functions that replace or widen core7's ────────────────────────────────────────── */
  const allNodes = V.nodes;
  const equipment = (key) => cached(`ka:equipment:${key}`, () => allNodes(key).filter((e) => !isUp(key, e.id)));
  const baseAlerts = V.alerts;
  function alerts(key, opts) {
    const o = opts || {}; const list = baseAlerts(key, { sensorId: o.sensorId, state: o.state });
    return list.filter((a) => (!o.eqId || a.eqId === o.eqId || (a.subject && a.subject.id === o.eqId)) && (!o.upId || a.upId === o.upId) && (!o.subject || matchSubject(a.subject, o.subject)));
  }
  const matchSubject = (s, want) => !!s && (typeof want === 'string' ? s.kind === want : s.kind === want.kind && (want.id == null || s.id === want.id));
  const baseIssues = __.issues;
  function issues(key, opts) {
    const o = opts || {}; const list = baseIssues(key, { status: o.status, commissioning: o.commissioning });
    if (!o.eqId && !o.upId && !o.subject) return list;
    const out = []; const E = eff(key); const parts = o.upId && o.includeShared && E ? new Set((E.byUp[o.upId] || []).map((m) => m.eqId)) : null;
    list.forEach((i) => {
      const s = i.subject || {};
      if (o.eqId && !(i.eqId === o.eqId || i.causedBy === o.eqId || s.id === o.eqId)) return;
      if (o.subject && !matchSubject(s, o.subject)) return;
      if (o.upId) { if (s.kind === 'up' && s.id === o.upId) out.push(i); else if (parts && s.kind === 'eq' && parts.has(s.id)) out.push({ ...i, shared: true, sharedVia: s.id, sharedText: `Shared · on ${tagOf(key, s.id)}` }); return; }
      out.push(i);
    });
    return out;
  }
  const baseTasks = V.tasks;
  function tasks(key, opts) {
    const o = opts || {}; const list = baseTasks(key, { status: o.status, eqId: o.eqId && !isUp(key, o.eqId) ? o.eqId : undefined });
    return list.filter((t) => (!o.eqId || !isUp(key, o.eqId) || (t.subject && t.subject.id === o.eqId)) && (!o.upId || t.upId === o.upId) && (!o.subject || matchSubject(t.subject, o.subject)));
  }
  /* Report a problem: on a unit process (its type's Issue types), on equipment (its type's), never on the whole plant yet */
  function report(key, subjectRef, issueTypeId, opts) {
    const P = PS(key); if (!P) return { ok: false, error: 'No such plant.' };
    const s = subjectOf(key, subjectRef && typeof subjectRef === 'object' && subjectRef.kind === 'plant' ? { kind: 'plant' } : subjectRef);
    if (s && s.kind === 'plant') return { ok: false, error: 'No problems are written for the whole plant yet. Report it on the unit process or equipment where you saw it.' };
    if (!s) return { ok: false, error: 'No such unit process or equipment.' };
    const it = (window.ISSUES || []).find((i) => i.id === issueTypeId); if (!it) return { ok: false, error: 'That problem is not in the library.' };
    if (!issueTypesFor(key, s).some((x) => x.id === issueTypeId)) return { ok: false, error: `${it.name} is not one of the problems written for ${s.text}.` };
    const band = (opts && opts.band) || 'minor'; const t = now(); const commissioning = P.state === 'commissioning';
    const flow = it.flow && __.libFlow(it.flow) ? it.flow : null;
    const iss = { id: __.nextId('is'), plant: key, alertId: null, issueTypeId, title: it.name, eqId: s.id, subject: { kind: s.kind, id: s.id }, sensorId: null, band, peak: null, opened: t, closed: null, cleared: null, status: 'open', terms: null, commissioning, told: [], diag: { flowId: flow, path: [], causeId: null }, fix: { flowId: null, done: [] }, causedBy: null, falseAlarm: false, closedHow: null, reported: true, homeToConfirm: false, log: [] };
    iss.told = commissioning ? [] : __.tellList(key, band, false, t);
    __.ilog(iss, t, `Reported by ${ME} on ${s.tag}: ${it.name}`); P.issues.unshift(iss);
    __.addActivity(t, key, `Problem reported on ${s.tag}: ${it.name}`, 'issue');
    __.touch(); __.persist(); return { ok: true, issue: V.issue(key, iss.id), id: iss.id };
  }

  /* ── the seed ─────────────────────────────────────────────────────────────────────────────── */
  /* before v7/1's seed steps: each unit-process type gets its content (a copy of its content-from type's), and each basin or
     reactor node reads its proposed unit-process type, so everything the seed binds comes from the unit-process type */
  __.onSeed('before', () => {
    const sets = C.S.lib.standardSets;
    UP_TYPES.forEach((t) => {
      const from = contentFromName(t); const src = sets.find((x) => x.type === from && !x.upType);
      const copy = src ? JSON.parse(JSON.stringify(src)) : { usedAt: 0, alerts: [], schedules: [] };
      const set = { ...copy, id: `ss_up_${t.id}`, type: t.name, upType: t.id, contentFromName: from };
      const i = sets.findIndex((x) => x.type === t.name); if (i >= 0) sets[i] = set; else sets.push(set);
    });
    ORDER.forEach((key) => { const I = identify(key); if (!I) return; I.ups.forEach((u) => { const e = eqRaw(key, u.id); if (e) e.libType = TYPE_BY_ID[u.typeId].name; }); });
    __.touch();
  });
  /* the structure each plant starts with; the sample plants' passes were confirmed by a person when they were commissioned */
  const SEED_PASS = {
    vedanta: { runAt: '2026-10-23T10:00', at: '2026-10-23T10:25', by: 'Satyadev Singh',
      add: [['v_eq1', 'v_p1', 'Lifts raw effluent into this tank'], ['v_eq1', 'v_p2', 'Lifts raw effluent into this tank'], ['v_eq1', 'v_mx1', 'Mixes this tank; no pipe is drawn for it'], ['v_ts1', 'v_sp1', 'Draws sludge from this settler']],
      notPart: [['v_fp1', 'Sludge dewatering: the plant graph has no unit process for it']] },
    manesar: { runAt: '2026-09-01T08:40', at: '2026-09-01T08:40', by: 'Swadesh Singh',
      add: [['cl1', 'sp1', 'Draws sludge from this clarifier'], ['uf1', 'cdu', 'Doses hypo into the UF outlet']],
      notPart: [['bs1', 'Sits in the inlet channel; the plant graph has no screening unit']] },
    bawal: { runAt: '2026-07-15T08:40', at: '2026-07-15T08:40', by: 'Rohit Jain',
      add: [['sc_mgf1', 'sc_p1', 'Feeds this filter'], ['sc_mgf1', 'sc_p2', 'Feeds this filter'], ['sc_uf1', 'sc_dp1', 'Treats the UF outlet'], ['sc_uf1', 'sc_dt1', 'Treats the UF outlet'], ['sc_uf1', 'sc_cav', 'Treats the UF outlet']],
      notPart: [['sc_bs1', 'Sits ahead of the raw-water pumps; no screening unit in the graph'], ['sc_sabre', 'A monitoring device, not part of the process']] },
  };
  /* "Structure confirmed: 4 unit processes, 2 control groups. P-1, P-2 and MX-1 added to EQ-1; SP-1 added to TS-1; FP-1 marked not
     part of any unit process", worked out from what the seed placed */
  function seedConfirmText(key) {
    const E = eff(key); const ovs = structOvs(key).filter((o) => o.target.kind === 'member' && o.target.op === 'add');
    const ups = []; ovs.forEach((o) => { if (!ups.includes(o.target.upId)) ups.push(o.target.upId); });
    const bits = ups.map((u) => `${joinAnd(ovs.filter((o) => o.target.upId === u).map((o) => tagOf(key, o.target.eqId)))} added to ${tagOf(key, u)}`);
    const np = Object.keys(E.placement).filter((id) => E.placement[id] === 'notpart'); if (np.length) bits.push(`${joinAnd(tagsOf(key, np))} marked not part of any unit process`);
    return `Structure confirmed: ${plural(E.I.ups.length, 'unit process', 'unit processes')}, ${plural(E.cgs.filter((c) => c.state !== 'rejected').length, 'control group')}. ${bits.join('; ')}`;
  }
  __.onSeed('after', () => {
    const s = S(); s.structure = {}; const T = __.T;
    ORDER.forEach((key) => {
      if (!dOf(key)) return; const I = identify(key); const seed = SEED_PASS[key];
      const t0 = seed ? T(seed.runAt) : __.PLANT_META[key].since;
      s.structure[key] = { readAt: t0, runAt: t0, runBy: 'Automatic', sig: rowSigs(I), decisions: {}, confirmedAt: null, confirmedBy: null, flags: {}, undo: [] };
      if (!seed) return;
      const st = s.structure[key]; const at = T(seed.at);
      I.rows.filter((r) => r.kind !== 'unclassified').forEach((r) => { st.decisions[r.rowId] = { v: 'accepted', at, by: seed.by, token: null }; });
      seed.add.forEach(([upId, eqId, note]) => { if (!eqRaw(key, upId) || !eqRaw(key, eqId)) return; newOverride(key, { kind: 'member', upId, eqId, op: 'add' }, true, 'not proposed', { at, author: seed.by, note, said: I.unclassified.some((x) => x.eqId === eqId) ? 'Unclassified: no rule matches' : `Not proposed in ${tagOf(key, upId)}`, linkSig: linkSigOf(key, eqId) }); });
      seed.notPart.forEach(([eqId, note]) => { st.decisions[`u:${eqId}`] = { v: 'notpart', at, by: seed.by, token: null, note }; });
      __.touch();
      st.confirmedAt = structureDone(key) ? at : null; st.confirmedBy = st.confirmedAt ? seed.by : null;
    });
    __.touch();
    ORDER.forEach((key) => { if (dOf(key)) syncTiers(key); });
    __.touch();
    /* Activity: the plant graph read, and each sample plant's structure pass */
    const dp = 'digitalpaani';
    if (dOf(dp)) {
      const I = identify(dp); const sd = structure(dp);
      const text = `Plant graph read: ${plural(I.counts.nodes, 'piece', 'pieces')} of equipment and ${plural(I.counts.sensors, 'sensor')} from the real survey layout. Identification proposed ${plural(I.counts.ups, 'unit process', 'unit processes')} and ${plural(I.counts.cgs, 'control group')}; ${plural(sd.counts.unclassified, 'piece', 'pieces')} of equipment ${sd.counts.unclassified === 1 ? 'is' : 'are'} unclassified. Nothing reviewed yet`;
      if (!__.replaceActivity(dp, (x) => /^SCADA read:/.test(x.text), { text, kind: 'structure', who: null })) __.addActivity({ at: s.structure[dp].readAt, plant: dp, who: null, text, kind: 'structure' });
    }
    const ved = 'vedanta';
    if (dOf(ved)) {
      const I = identify(ved);
      const text = `Commissioning started: plant graph read, ${plural(I.counts.nodes, 'piece', 'pieces')} of equipment. Identification proposed ${plural(I.counts.ups, 'unit process', 'unit processes')} and ${plural(I.counts.cgs, 'control group')}; ${plural(I.counts.unclassified, 'piece', 'pieces')} of equipment ${I.counts.unclassified === 1 ? 'is' : 'are'} unclassified`;
      if (!__.replaceActivity(ved, (x) => /^Commissioning started:/.test(x.text), { text, kind: 'structure', who: null })) __.addActivity({ at: s.structure[ved].readAt, plant: ved, who: null, text, kind: 'structure' });
      const conf = { text: seedConfirmText(ved), kind: 'structure', who: SEED_PASS[ved].by, at: s.structure[ved].confirmedAt };
      if (!__.replaceActivity(ved, (x) => /^Accepted what SCADA found/.test(x.text), conf)) __.addActivity({ ...conf, plant: ved });
    }
    ['manesar', 'bawal'].forEach((key) => { if (dOf(key) && s.structure[key].confirmedAt) __.addActivity({ at: s.structure[key].confirmedAt, plant: key, who: SEED_PASS[key].by, text: seedConfirmText(key), kind: 'structure' }); });
    __.touch();
  });

  /* ── the public surface ─────────────────────────────────────────────────────────────────────── */
  Object.assign(V, {
    UP_TYPES: UP_TYPES.map((t) => ({ ...t, anchors: t.anchors.slice(), expected: t.expected.slice() })), GENERIC_TANKS: GENERIC_TANKS.slice(), STAGES: STAGES.map((s) => ({ ...s })), ROLE_LABEL: { ...ROLE_LABEL }, ANCHOR_CODES: ANCHOR_CODES.slice(),
    identify, structure, unitProcesses, unitProcess, upOfBasin, isUp, controlGroups, controlGroup, membershipOf, subjectOf, structurePass, structureDone, structureTrack,
    acceptStructure, rejectStructure, changeUpType, upTypeOptions, place, notPart, editMembers, makeControlGroup, editControlGroup, membershipPreview,
    undoStructure, canUndo, rerunIdentification, structureFlag, clearStructureFlag, drawing, bindingGroups, upTypes, upType, upTypesForCode, libKeyOf, surveyCheck, issueTypesFor,
    structureChange, structureChanges, linkSigOf,
    equipment, alerts, issues, tasks, report, tierInfo,
  });
  Object.assign(__, { structureEff: eff, structureBuild: build, structureRows: passRows, structureGraph: graph, upTier, derivedTier, syncTiers, UP_TYPE_BY_ID: TYPE_BY_ID });
})();
