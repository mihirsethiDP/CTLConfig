/* v7/2 · structure7.js · window.V7STRUCT — the plant's structure: the Structure page (a list for every plant, a drawing for the
   real plant graph), the structure pass, the control-group page and the structure modals.

   Loads after core7.js and its v7/2 extensions (window.V7), ui7.js (window.V7UI) and plant7.js (window.V7PLANT, the plant frame).
   Pure string renderers registered with V7UI.route; every action is a data-act handler registered with V7UI.on (the shell persists
   and re-renders after it). Every number and every consequence line comes from the core; this file only lays them out.

   ROUTES
     p/:plant/structure/:view?   Structure: view "list" (default) or "drawing" (the real plant graph only)
                                 query ?select=up:<id>|eq:<id>|cg:<id> · ?stage=<key>|none · ?show=shared|unclassified|underneath|proposed
                                       ?from=review (a back bar to the structure pass) · ?f=participation.<eqId> (highlight)
     p/:plant/review/structure   Review · the structure pass       query ?show=unclassified|shared|cgs
     p/:plant/cg/:id             a control group: members, what it feeds, the work its members carry
     aliases  p/:plant/equipment → the Structure list · p/:plant/scada → the structure pass ·
              p/:plant/review → the structure pass while it is open, else the bindings pass

   API (window.V7STRUCT), used by the object, list and work pages
     participantsCard(key, upId)     the "Participants" card for a unit process's aside
     participatesCard(key, eqId)     the "Participates in" card for a piece of equipment's Details
     participatesChips(key, eqId)    header chips: "Participates in: AT-1, AT-2" · "Unclassified" · "Not part of any unit process" ·
                                     "Control group: Air Blowers"
     subjectChip(key, subject)       "AT-2 · unit process" · "BL-1 · equipment" · "The plant"
     stageCrumb(key, nodeId)         {label, href, stage} for crumbs (a piece of equipment takes its first unit process's stage)
     passTabs(key, active)           the two pass tabs ("Structure pass · n" / "Structure pass ✓" · "Bindings pass · …")
     pages.{structure, pass, cg, review}(params) → html (the route functions)

   ACTIONS (data-act, prefix st:)  accept · accept-up · accept-cgs · accept-all · reject · type · place · notpart · tick · tick-all ·
     tick-none · bulk-place · bulk-notpart · rerun · undo · stage · node · zoom · remove · putback · unpend · pend-cancel ·
     pend-save · add-eq · cg-make · cg-add · cg-remove · multi-clear · note · dlg-up · dlg-eq · dlg-type · dlg-name · dlg-save

   STYLES  assets/structure7.css (prototype.html links it; if it is not linked, this module adds the <link> itself). */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const U = W.V7UI;
  if (!U) { if (W.console) console.error('structure7.js needs ui7.js (window.V7UI) loaded first'); return; }
  const V = () => W.V7 || null;
  const { esc, chip, btn, card, empty, note, filters } = U;

  /* ── helpers ──────────────────────────────────────────────────────────────────────────────────────────── */
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = (s) => encodeURIComponent(String(s));
  const encQ = (s) => encodeURIComponent(String(s)).replace(/%3A/gi, ':');
  const base = (key) => `#/p/${enc(key)}`;
  const upHref = (key, id, tab) => `${base(key)}/up/${enc(id)}${tab ? '/' + tab : ''}`;
  const eqHref = (key, id) => `${base(key)}/eq/${enc(id)}`;
  const cgHref = (key, id) => `${base(key)}/cg/${enc(id)}`;
  const sensorHref = (key, id) => `${base(key)}/sensor/${enc(id)}`;
  const passHref = (key, show) => `${base(key)}/review/structure${show && show !== 'all' ? `?show=${enc(show)}` : ''}`;
  const plural = (n, one, many) => U.plural(n, one, many);
  const pieces = (n) => `${n} ${n === 1 ? 'piece' : 'pieces'} of equipment`;
  function call(fn, fb) { try { const r = fn(); return r == null ? fb : r; } catch (e) { if (W.console) console.error('[structure7]', e && e.message ? e.message : e); return fb; } }
  function fnOf(name) { const v = V(); return v && typeof v[name] === 'function' ? v[name] : null; }
  function vcall(name, args, fb) { const f = fnOf(name); return f ? call(() => f.apply(V(), args || []), fb) : fb; }
  /* one block: if it fails, say so in place and keep the rest of the page */
  function part(label, fn) { try { return fn() || ''; } catch (e) { if (W.console) console.error('[structure7] ' + label, e); return note(`${label} could not be shown.`, 'bad'); } }
  const dget = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null);
  function joinAnd(xs) { const a = arr(xs).filter(Boolean); if (a.length < 2) return a.join(''); return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`; }
  function qs(o) {
    const keys = Object.keys(o || {}).filter((k) => o[k] != null && o[k] !== '');
    return keys.length ? '?' + keys.map((k) => `${enc(k)}=${encQ(o[k])}`).join('&') : '';
  }
  function structHref(key, view, q) { return `${base(key)}/structure${view === 'drawing' ? '/drawing' : ''}${qs(q)}`; }
  function parseSel(s) { const m = /^(up|eq|cg):(.+)$/.exec(String(s || '')); return m ? { kind: m[1], id: m[2] } : null; }

  function plantOf(key) { return key ? vcall('plant', [key], null) : null; }
  const isLive = (key) => { const p = plantOf(key); return !!p && p.state === 'live'; };
  function nodeOf(key, id) { return id ? vcall('eq', [key, id], null) : null; }
  function tagOf(key, id) { const n = nodeOf(key, id); return n ? n.tag : String(id || ''); }
  function nodesOf(key) { return arr(vcall('nodes', [key], [])); }
  const isUpNode = (key, id) => !!vcall('isUp', [key, id], false);
  function structOf(key) { return vcall('structure', [key], null); }
  function passOf(key, show) { return vcall('structurePass', [key, { show: show || 'all' }], null); }
  function ups(key) { return arr(vcall('unitProcesses', [key], [])); }
  function upOf(key, id) { return vcall('unitProcess', [key, id], null); }
  function cgs(key, all) { return arr(vcall('controlGroups', [key, all ? { all: true } : undefined], [])); }
  function cgOf(key, id) { return vcall('controlGroup', [key, id], null); }
  function membership(key, eqId) { return vcall('membershipOf', [key, eqId], null); }
  function preview(key, changes) { return changes && changes.length ? vcall('membershipPreview', [key, changes], null) : null; }
  const fmt = (ms) => (ms == null ? '—' : U.fmt(ms));
  function stagesOf() { const s = V() && V().STAGES; return arr(s).length ? s : [{ key: 'preliminary', label: 'Preliminary' }, { key: 'primary', label: 'Primary' }, { key: 'secondary', label: 'Secondary' }, { key: 'tertiary', label: 'Tertiary' }, { key: 'sludge', label: 'Sludge handling' }, { key: null, label: 'No stage' }]; }
  /* the decision note of a piece of equipment marked not part of any unit process */
  function notPartNote(key, eqId) { return call(() => { const st = V().S.structure[key]; const d = st && st.decisions && st.decisions['u:' + eqId]; return d && d.v === 'notpart' ? { note: d.note || '', by: d.by || null, at: d.at || null } : null; }, null); }
  /* blowers and pumps run together under one setpoint; only they can be members of a control group */
  const CG_CODES = ['BLW', 'M_BLW', 'PMP', 'SUB_PMP', 'BT_PMP', 'D_PMP'];
  const PUMP_CODES = ['PMP', 'SUB_PMP', 'BT_PMP', 'D_PMP'];
  const isValveCode = (c) => /^VALVE_/.test(String(c || ''));
  const H = (html) => ({ html: String(html) });

  /* ── module state (per plant; nothing here is saved: decisions live in the core) ─────────────────────────── */
  const STATE = { tick: {}, pend: {}, multi: {}, zoom: {}, view: {}, dlg: null, last: null, scrolled: '' };
  const ticks = (key) => (STATE.tick[key] = STATE.tick[key] || new Set());
  const pend = (key) => (STATE.pend[key] = STATE.pend[key] || { ops: [], note: '' });
  const multi = (key) => (STATE.multi[key] = STATE.multi[key] || []);

  /* ── chips and words ──────────────────────────────────────────────────────────────────────────────────── */
  const MSTATE = {
    proposed: ['Proposed', 'prop'], confirmed: ['Confirmed', 'ok'], accepted: ['Confirmed', 'ok'], added: ['Added', 'ok'], made: ['Added', 'ok'],
    changed: ['Changed', 'info'], rejected: ['Rejected', 'muted'], placed: ['Placed', 'ok'], notpart: ['Not part of any unit process', 'muted'],
    unclassified: ['Unclassified', 'bad'], removed: ['Removed', 'muted'], underneath: ['Changed underneath', 'muted'],
  };
  function mChip(state, label) {
    const m = MSTATE[state] || [label || String(state || ''), 'muted'];
    return chip(label || m[0], { tone: m[1], cls: `st-ms st-ms-${esc(state || 'x')}` });
  }
  function tierChips(ti) {
    if (!ti || !ti.value) return '';
    const src = ti.chip && ti.chip.text ? ' ' + chip(ti.chip.text, { tone: ti.chip.tone || 'lib', cls: 'st-src', title: ti.chip.sub || null }) : '';
    return chip(`Criticality tier ${ti.value}`, { cls: 'st-tier' }) + src;
  }
  function plantChips(p) {
    const st = p.state === 'live' ? `Live since ${U.fmtDay(p.since)}` : 'Commissioning · nothing is sent';
    return [chip(p.type || '—', { mono: true }), chip(st, { tone: p.state === 'live' ? 'ok' : 'warn', cls: 'st-plantstate' }), p.sample === false ? chip('Real plant graph', { tone: 'info' }) : chip('Sample plant', { tone: 'muted' })];
  }

  /* ── the plant frame (plant7's when it is there) ─────────────────────────────────────────────────────── */
  function notFound(key) {
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', sub: key ? `There is no plant "${key}" in the prototype.` : '', body: empty('This plant is not in the prototype.', btn('All Plants', { href: '#/plants', kind: 'primary' })) });
  }
  function ownTabs(key, p) {
    const b = base(key);
    const list = p.state === 'live'
      ? [['coverage', 'Coverage', ''], ['readings', 'Readings', '/readings'], ['structure', 'Structure', '/structure'], ['triggers', 'Triggers', '/triggers'], ['issues', 'Issues', '/issues'], ['tasks', 'Tasks', '/tasks'], ['people', 'People', '/people'], ['deviations', 'Deviations', '/deviations'], ['activity', 'Activity', '/activity']]
      : [['readiness', 'Readiness', ''], ['structure', 'Structure', '/structure'], ['triggers', 'Triggers', '/triggers'], ['issues', 'Issues', '/issues'], ['tasks', 'Tasks', '/tasks'], ['people', 'People', '/people'], ['deviations', 'Deviations', '/deviations'], ['activity', 'Activity', '/activity']];
    return list.map(([id, label, suf]) => ({ id, label, href: b + suf, count: id === 'structure' && p.unclassified ? p.unclassified : null }));
  }
  function frame(key, body, o) {
    o = o || {};
    /* the review queue (both passes) is reached from the plant's home, so its tab is the home tab; the rest is Structure */
    const active = o.active || 'structure';
    const P = W.V7PLANT;
    if (P && typeof P.frame === 'function') { const out = call(() => P.frame(key, active, body, o), null); if (typeof out === 'string' && out) return out; }
    const p = plantOf(key); if (!p) return notFound(key);
    const tabs = ownTabs(key, p);
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }].concat(arr(o.crumbs)), title: o.title || p.name, sub: o.sub, chips: plantChips(p).concat(arr(o.chips)), actions: o.actions, tabs, active: active === 'review' ? tabs[0].id : active, body, aside: o.aside, cls: ('pg-plant st ' + (o.cls || '')).trim() });
  }

  /* ── the graph near a node (the drawing's pipes; valves pass water through) ─────────────────────────────── */
  function adjacency(key) {
    const dr = vcall('drawing', [key], null); if (!dr) return null;
    const code = {}; nodesOf(key).forEach((n) => { code[n.id] = n.code; });
    const adj = {}; arr(dr.nodes).forEach((n) => { adj[n.id] = []; });
    arr(dr.links).forEach(([a, b]) => { if (adj[a] && adj[b] && a !== b) { adj[a].push(b); adj[b].push(a); } });
    return { adj, code };
  }
  function hop(g, start) {
    const res = new Set(); const seen = new Set([start]); const st = (g.adj[start] || []).slice();
    while (st.length) { const x = st.shift(); if (seen.has(x)) continue; seen.add(x); if (isValveCode(g.code[x])) st.push(...(g.adj[x] || [])); else res.add(x); }
    return [...res];
  }
  /* unit processes next to a piece of equipment: on its pipes, through valves and at most one pump */
  function upsNextTo(key, eqId) {
    const f = fnOf('nextTo'); if (f) return arr(call(() => f(key, eqId), []));
    const g = adjacency(key); if (!g) return [];
    const out = new Set();
    hop(g, eqId).forEach((n) => { if (isUpNode(key, n)) out.add(n); else if (PUMP_CODES.includes(g.code[n])) hop(g, n).forEach((m) => { if (m !== eqId && isUpNode(key, m)) out.add(m); }); });
    const order = ups(key).map((u) => u.id);
    return [...out].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  /* equipment next to a unit process: on its pipes, through valves */
  function eqNextTo(key, upId) {
    const g = adjacency(key); if (!g) return [];
    return hop(g, upId).filter((n) => !isUpNode(key, n));
  }

  /* ── undo and toasts ──────────────────────────────────────────────────────────────────────────────────── */
  function undoAction(key, token) {
    const r = vcall('undoStructure', [key, token], null);
    U.toast(r && r.ok ? r.toast : (r && r.error) || 'Nothing to undo.');
    return r;
  }
  /* a core result → its toast, with Undo for 10 s; false on a refusal (the refusal is the toast) */
  function said(key, r, fb) {
    if (!r || r.ok === false) { U.toast((r && r.error) || 'That did not work.'); return false; }
    if (r.token) STATE.last = { key, token: r.token };
    U.toast(r.toast || fb || 'Saved', r.token ? { undo: () => undoAction(key, r.token), ms: 10000 } : undefined);
    return true;
  }
  function clearPlant(key) { ticks(key).clear(); STATE.multi[key] = []; }

  /* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
     The structure pass (p/:plant/review/structure)
     ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function bindingsInfo(key) {
    const bp = vcall('bindingsPass', [key], null);
    return bp && bp.open !== false && bp.counts ? bp : null;
  }
  function passTabs(key, active) {
    const sp = passOf(key); if (!sp) return '';
    const done = !!sp.done; const bp = done ? bindingsInfo(key) : null;
    const t1 = done ? 'Structure pass ✓' : `Structure pass · ${sp.counts.toReview != null ? sp.counts.toReview : sp.counts.all}`;
    const a1 = `<a class="tab${active !== 'bindings' ? ' on' : ''}" href="${esc(passHref(key))}" role="tab"${active !== 'bindings' ? ' aria-selected="true"' : ''}>${esc(t1)}</a>`;
    const a2 = done
      ? `<a class="tab${active === 'bindings' ? ' on' : ''}" href="${esc(base(key) + '/review/bindings')}" role="tab"${active === 'bindings' ? ' aria-selected="true"' : ''}>${esc(bp ? `Bindings pass · ${bp.counts.all}` : 'Bindings pass')}</a>`
      : '<span class="tab st-tab-off" role="tab" aria-disabled="true" title="The bindings pass opens when the structure pass is confirmed.">Bindings pass · waiting</span>';
    return `<nav class="tabs st-passtabs" role="tablist" aria-label="Review">${a1}${a2}</nav>`;
  }
  /* the action that confirmed the structure, while it can still be undone */
  function confirmUndo(key) {
    const acts = arr(vcall('activity', [{ plant: key, limit: 60 }], []));
    const e = acts.find((x) => x && x.undoToken && /^Structure confirmed:/.test(String(x.text || '')));
    return e && vcall('canUndo', [key, e.undoToken], false) ? e.undoToken : null;
  }
  function rowActions(key, r) {
    const a = arr(r.actions); const out = [];
    if (a.includes('accept')) out.push(btn('Accept', { act: 'st:accept', data: { plant: key, row: r.rowId }, small: true }));
    if (a.includes('change') && r.kind === 'members') out.push(btn('Change', { href: structHref(key, vcall('drawing', [key], null) ? 'drawing' : 'list', { select: `up:${r.upId}`, from: 'review' }), small: true, kind: 'ghost' }));
    if (a.includes('change') && r.kind === 'cg') out.push(btn('Change', { href: structHref(key, vcall('drawing', [key], null) ? 'drawing' : 'list', { select: `cg:${r.cgId}`, from: 'review' }), small: true, kind: 'ghost' }));
    if (a.includes('reject')) out.push(btn('Reject', { act: 'st:reject', data: { plant: key, row: r.rowId }, small: true, kind: 'ghost' }));
    if (a.includes('place')) out.push(btn('Place in…', { act: 'st:place', data: { plant: key, eq: r.eqIds[0] }, small: true }));
    if (a.includes('notpart')) out.push(btn('Not part of any unit process', { act: 'st:notpart', data: { plant: key, eq: r.eqIds[0] }, small: true, kind: 'ghost' }));
    return out.join('');
  }
  function alsoIn(key, list) {
    const xs = arr(list); if (!xs.length) return '';
    return `<span class="st-also">Also in ${xs.map((x) => `<a href="${esc(upHref(key, x.upId))}">${esc(x.tag)}</a>`).join(', ')}</span>`;
  }
  function passRow(key, r, live) {
    const tgt = r.kind === 'readings' ? 'Sensors on this unit process' : r.why;
    return `<li class="st-prow st-prow-${esc(r.kind)}${r.decided ? ' is-decided' : ''}" id="st-row-${esc(r.rowId.replace(/[^\w-]/g, '_'))}">
      <div class="st-prow-m"><div class="st-prow-t"><span class="st-prow-tt">${esc(r.title)}</span> ${mChip(r.state, r.stateLabel)} ${alsoIn(key, r.alsoIn)}</div>${tgt ? `<div class="st-prow-s">${esc(tgt)}</div>` : ''}${r.note ? `<div class="st-prow-s">Note: ${esc(r.note)}</div>` : ''}</div>
      <div class="st-prow-a">${rowActions(key, r)}</div></li>`;
  }
  function unclassifiedList(key, rows, opts) {
    const o = opts || {}; const sel = ticks(key);
    const ids = rows.map((r) => r.eqIds[0]);
    [...sel].forEach((id) => { if (!ids.includes(id)) sel.delete(id); });
    const items = rows.map((r) => {
      const id = r.eqIds[0]; const n = nodeOf(key, id) || { tag: id, name: '', typeName: '' }; const on = sel.has(id);
      const tgt = o.target === id;
      return `<li class="st-urow${on ? ' is-on' : ''}${tgt ? ' is-target' : ''}" id="st-u-${esc(id)}">
        <label class="st-tick"><input type="checkbox" id="st-tick-${esc(id)}" data-act="st:tick" data-plant="${esc(key)}" data-eq="${esc(id)}"${on ? ' checked' : ''} aria-label="Select ${esc(n.tag)}"></label>
        <div class="st-urow-m"><div class="st-urow-t"><a href="${esc(eqHref(key, id))}">${esc(n.tag)}</a> · ${esc(n.name)} · ${esc(n.typeName)}</div><div class="st-urow-s">${esc(r.why || '')}</div></div>
        <div class="st-urow-a">${btn('Place in…', { act: 'st:place', data: { plant: key, eq: id }, small: true })}${btn('Not part of any unit process', { act: 'st:notpart', data: { plant: key, eq: id }, small: true, kind: 'ghost' })}</div></li>`;
    }).join('');
    const bar = sel.size
      ? `<div class="st-bulk" role="region" aria-label="Selected equipment"><b>${sel.size} selected</b><span class="st-bulk-a">${btn('Place in…', { act: 'st:bulk-place', data: { plant: key }, small: true, kind: 'primary' })}${btn('Not part of any unit process', { act: 'st:bulk-notpart', data: { plant: key }, small: true })}${btn('Clear', { act: 'st:tick-none', data: { plant: key }, small: true, kind: 'ghost' })}</span></div>`
      : '';
    return `${bar}<ul class="st-urows">${items}</ul>`;
  }
  function unclassifiedCard(key, rows, opts) {
    if (!rows.length) return '';
    const all = ticks(key).size === rows.length;
    return card({
      title: `Unclassified · no rule placed these (${rows.length})`,
      sub: 'Each one blocks go live until it is placed in a unit process or marked not part of any unit process.',
      tone: 'bad', cls: 'st-unclassified', id: 'st-unclassified',
      actions: [all ? btn('Clear', { act: 'st:tick-none', data: { plant: key }, small: true, kind: 'ghost' }) : btn('Select all', { act: 'st:tick-all', data: { plant: key }, small: true, kind: 'ghost' })],
      body: unclassifiedList(key, rows, opts),
    });
  }
  function passPage(params) {
    const key = params && params.plant; const p = plantOf(key); if (!p) return notFound(key);
    const q = (params && params._q) || {};
    const show = ['unclassified', 'shared', 'cgs'].includes(q.show) ? q.show : 'all';
    const sp = passOf(key, show); const all = passOf(key, 'all');
    if (!sp || !all) return frame(key, empty('This plant has no plant graph to review yet.'), { crumbs: [{ label: 'Review' }], title: 'Review', active: 'review' });
    const live = p.state === 'live'; const s = structOf(key) || {};
    const hasDrawing = !!vcall('drawing', [key], null);
    const c = all.counts;
    const intro = `<p class="st-intro">The survey wrote the plant graph and identification proposed this structure. Accept it, change it, or place what no rule placed. Plant graph read ${esc(fmt(s.readAt || s.runAt || all.runAt))}.</p>`;
    const tok = all.done ? confirmUndo(key) : null;
    const done = all.done && all.banner ? `<div class="banner tone-ok st-done"><div class="banner-t">✓ ${esc(all.banner)}</div>${tok ? `<div class="banner-a">${btn('Undo', { act: 'st:undo', data: { plant: key, token: tok }, small: true })}</div>` : ''}</div>` : '';
    const chips = filters([
      { label: 'All', count: c.all, href: passHref(key, 'all'), on: show === 'all' },
      { label: 'Unclassified', count: c.unclassified, href: passHref(key, 'unclassified'), on: show === 'unclassified' },
      { label: 'Shared', count: c.shared, href: passHref(key, 'shared'), on: show === 'shared' },
      { label: 'Control groups', count: c.cgs, href: passHref(key, 'cgs'), on: show === 'cgs' },
    ]);
    const tools = [
      hasDrawing ? btn('Open on drawing', { href: structHref(key, 'drawing'), small: true }) : btn('Open the list', { href: structHref(key, 'list'), small: true }),
      btn('Re-run identification', { act: 'st:rerun', data: { plant: key }, small: true, kind: 'ghost' }),
      c.proposed ? btn(`Accept all ${c.proposed} that are proposed`, { act: 'st:accept-all', data: { plant: key }, kind: 'primary', small: true })
        : btn('Accept all that are proposed', { disabled: true, title: 'Nothing left to accept here.', small: true }),
    ].join('');
    const bar = `<div class="st-passbar">${chips}<div class="st-passbar-a">${tools}</div></div>`;
    const groups = sp.groups.map((g) => {
      if (g.key === 'unclassified') return part('The unclassified equipment', () => unclassifiedCard(key, g.rows, {}));
      if (g.key === 'cgs') {
        return card({
          title: g.title, cls: 'st-pgroup st-pgroup-cgs', id: 'st-g-cgs',
          actions: [g.acceptCount ? btn(`Accept ${g.acceptCount}`, { act: 'st:accept-cgs', data: { plant: key }, small: true }) : ''],
          body: `<ul class="st-prows">${g.rows.map((r) => passRow(key, r, live)).join('')}</ul>`,
        });
      }
      const u = upOf(key, g.upId);
      const byHand = u ? u.participants.filter((x) => x.state === 'added').map((x) => x.tag) : [];
      const typeBtn = g.upRow && arr(g.upRow.actions).includes('changeType') ? btn('Change type', { act: 'st:type', data: { plant: key, up: g.upId }, small: true }) : '';
      const head = `<span class="st-gt"><a href="${esc(upHref(key, g.upId))}">${esc(g.title)}</a></span> ${mChip(g.state, g.stateLabel)} ${chip(`Stage: ${g.stageLabel}`, { tone: 'muted' })}`;
      return card({
        title: head, sub: g.why, cls: 'st-pgroup', id: `st-g-${g.upId}`,
        actions: [typeBtn, g.acceptCount ? btn(`Accept ${g.acceptCount}`, { act: 'st:accept-up', data: { plant: key, up: g.upId }, small: true, kind: 'primary' }) : ''],
        body: (g.rows.length ? `<ul class="st-prows">${g.rows.map((r) => passRow(key, r, live)).join('')}</ul>` : `<p class="st-quiet">${u && u.participants.length ? 'Nothing else to decide here.' : 'No equipment takes part in it.'}</p>`)
          + (byHand.length ? `<p class="st-quiet">Placed by hand: ${esc(byHand.join(', '))}</p>` : ''),
      });
    }).join('');
    const body = passTabs(key, 'structure') + intro + done + bar
      + (groups || empty(show === 'all' ? 'Nothing to review.' : 'Nothing here with this filter.', btn('Show all', { href: passHref(key) })))
      + '<p class="st-foot">Sensors move with the plant graph: correct the survey, then re-run identification.</p>';
    return frame(key, body, { crumbs: [{ label: 'Review', href: `${base(key)}/review` }], title: 'Review', cls: 'st-pass', active: 'review' });
  }

  /* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
     The Structure page (p/:plant/structure/:view?)
     ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function pendFor(key, upId) { return pend(key).ops.filter((o) => o.upId === upId); }
  function pendHas(key, op, upId, eqId) { return pend(key).ops.some((o) => o.op === op && o.upId === upId && o.eqId === eqId); }
  function togglePending(key, op, upId, eqId) {
    const pd = pend(key); const i = pd.ops.findIndex((o) => o.upId === upId && o.eqId === eqId);
    if (i >= 0) { const was = pd.ops[i].op; pd.ops.splice(i, 1); if (was === op) return; }
    pd.ops.push({ op, upId, eqId });
  }
  /* "SRCP-1, SRCP-2 added to TS-1; SRCP-3 removed from MBBR-5" */
  function pendText(key, ops) {
    const groups = []; const at = {};
    ops.forEach((o) => { const k = `${o.op}|${o.upId}`; if (!(k in at)) { at[k] = groups.length; groups.push({ op: o.op, upId: o.upId, tags: [] }); } groups[at[k]].tags.push(tagOf(key, o.eqId)); });
    return groups.map((g) => `${g.tags.join(', ')} ${g.op === 'add' ? 'added to' : 'removed from'} ${tagOf(key, g.upId)}`).join('; ');
  }
  function previewLines(pv, extra) {
    const lines = arr(pv && pv.lines).concat(arr(extra));
    return lines.length ? `<ul class="st-lines">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
  }
  function reasonField(key, scope, value, o) {
    const live = isLive(key); o = o || {};
    if (!live && !o.always) return '';
    const label = live ? 'Reason (required on a Live plant)' : (o.label || 'Note (optional)');
    return `<div class="field st-reason"><label class="field-l" for="st-note-${esc(scope)}">${esc(label)}</label><textarea id="st-note-${esc(scope)}" name="st-note" data-act="st:note" data-scope="${esc(scope)}" data-plant="${esc(key)}" data-live rows="2">${esc(value || '')}</textarea></div>`;
  }
  function pendingBar(key) {
    const pd = pend(key); if (!pd.ops.length) return '';
    const pv = preview(key, pd.ops); const live = isLive(key);
    const blocked = live && !String(pd.note || '').trim();
    return `<div class="st-pending" role="region" aria-label="Changes to save">
      <p class="st-pending-t"><b>Changes to save:</b> ${esc(pendText(key, pd.ops))}</p>
      ${previewLines(pv)}${reasonField(key, 'pending', pd.note)}
      <div class="st-pending-a">${btn('Cancel', { act: 'st:pend-cancel', data: { plant: key }, kind: 'ghost', small: true })}${btn('Save', { act: 'st:pend-save', data: { plant: key }, kind: 'primary', small: true, id: 'st-pend-save', disabled: blocked, title: blocked ? 'Give a reason first: this plant is Live.' : null })}</div></div>`;
  }
  function partChip(key, upId, x, o) {
    o = o || {};
    const removing = pendHas(key, 'remove', upId, x.eqId);
    const st = removing ? 'removing' : x.state;
    const also = x.alsoIn && x.alsoIn.length ? ` <span class="st-also">Also in ${x.alsoIn.map((a) => `<a href="${esc(upHref(key, a.upId))}">${esc(a.tag)}</a>`).join(', ')}</span>` : '';
    const stChip = removing ? chip('Removing', { tone: 'muted', cls: 'st-ms st-ms-removing' }) : mChip(x.state, x.stateLabel);
    const x1 = o.edit === false ? '' : removing
      ? `<button type="button" class="st-x" data-act="st:unpend" data-plant="${esc(key)}" data-up="${esc(upId)}" data-eq="${esc(x.eqId)}" title="Keep ${esc(x.tag)}">Keep</button>`
      : `<button type="button" class="st-x" data-act="st:remove" data-plant="${esc(key)}" data-up="${esc(upId)}" data-eq="${esc(x.eqId)}" aria-label="Take ${esc(x.tag)} out of ${esc(tagOf(key, upId))}" title="Take it out">×</button>`;
    return `<li class="st-p st-p-${esc(st)}${o.target === x.eqId ? ' is-target' : ''}"><a href="${esc(eqHref(key, x.eqId))}">${esc(x.tag)}</a> ${stChip}${also}${x1}</li>`;
  }
  function participantsBlock(key, u, o) {
    o = o || {};
    const parts = arr(u.participants).filter((x) => !o.only || o.only(x));
    const roles = []; const at = {};
    parts.forEach((x) => { const k = x.roleLabel || 'Other'; if (!(k in at)) { at[k] = roles.length; roles.push({ label: k, items: [] }); } roles[at[k]].items.push(x); });
    const adds = pendFor(key, u.id).filter((x) => x.op === 'add');
    const rolesHtml = roles.map((r) => `<div class="st-role"><span class="st-role-l">${esc(r.label)}:</span><ul class="st-plist">${r.items.map((x) => partChip(key, u.id, x, o)).join('')}</ul></div>`).join('');
    const addHtml = adds.length ? `<div class="st-role"><span class="st-role-l">Adding:</span><ul class="st-plist">${adds.map((x) => `<li class="st-p st-p-adding"><a href="${esc(eqHref(key, x.eqId))}">${esc(tagOf(key, x.eqId))}</a> ${chip('Adding', { tone: 'info', cls: 'st-ms st-ms-adding' })}<button type="button" class="st-x" data-act="st:unpend" data-plant="${esc(key)}" data-up="${esc(u.id)}" data-eq="${esc(x.eqId)}" aria-label="Do not add ${esc(tagOf(key, x.eqId))}">×</button></li>`).join('')}</ul></div>` : '';
    const rem = arr(u.removed);
    const remHtml = rem.length && !o.only ? `<div class="st-role st-removed"><span class="st-role-l">Removed:</span><ul class="st-plist">${rem.map((x) => `<li class="st-p st-p-removed"><s>${esc(x.tag)}</s>${x.note ? ` <span class="st-quiet">${esc(x.note)}</span>` : ''} ${pendHas(key, 'add', u.id, x.eqId) ? chip('Putting back', { tone: 'info' }) : `<button type="button" class="st-link" data-act="st:putback" data-plant="${esc(key)}" data-up="${esc(u.id)}" data-eq="${esc(x.eqId)}">Put back</button>`}</li>`).join('')}</ul></div>` : '';
    if (!rolesHtml && !addHtml && !remHtml) return '<p class="st-quiet">No participants</p>';
    return rolesHtml + addHtml + remHtml;
  }
  function readingsLine(key, upId) {
    const ss = arr(vcall('sensors', [key, upId], [])).filter((s) => !s.nextPhase);
    return ss.length ? `Readings: ${ss.map((s) => s.name).join(', ')}` : 'No sensors';
  }
  function upRow(key, u, o) {
    o = o || {};
    const cgChips = arr(u.cgIds).map((id) => { const c = cgOf(key, id); return c ? chip(`Control group: ${c.name}`, { href: cgHref(key, id), tone: 'muted' }) : ''; }).join(' ');
    const sel = o.sel && o.sel.kind === 'up' && o.sel.id === u.id;
    return `<li class="st-up${sel ? ' is-sel is-target' : ''}" id="st-up-${esc(u.id)}">
      <div class="st-up-h"><a class="st-up-t" href="${esc(upHref(key, u.id))}"><b>${esc(u.tag)}</b> · ${esc(u.typeName)}</a> ${mChip(u.typeState, u.typeStateLabel)} ${tierChips(u.tierSource)}</div>
      <div class="st-up-r">${esc(readingsLine(key, u.id))}</div>
      <div class="st-up-p">${participantsBlock(key, u, { only: o.only, target: o.target })}</div>
      ${cgChips ? `<div class="st-up-c">${cgChips}</div>` : ''}
      <div class="st-up-a">${btn('Open', { href: upHref(key, u.id), small: true })}${btn('Add equipment…', { act: 'st:add-eq', data: { plant: key, up: u.id }, small: true, kind: 'ghost' })}${btn(sel ? 'Selected' : 'Select', { href: structHref(key, o.view, Object.assign({}, o.q, { select: sel ? null : `up:${u.id}` })), small: true, kind: 'ghost' })}</div></li>`;
  }
  function cgRow(key, c, o) {
    o = o || {};
    const sel = o.sel && o.sel.kind === 'cg' && o.sel.id === c.id;
    const members = c.members.map((m) => `<li class="st-p"><a href="${esc(eqHref(key, m.eqId))}">${esc(m.tag)}</a>${c.state === 'rejected' ? '' : `<button type="button" class="st-x" data-act="st:cg-remove" data-plant="${esc(key)}" data-cg="${esc(c.id)}" data-eq="${esc(m.eqId)}" aria-label="Take ${esc(m.tag)} out of ${esc(c.name)}" title="Take it out">×</button>`}</li>`).join('');
    return `<li class="st-cg${sel ? ' is-sel is-target' : ''}" id="st-cg-${esc(c.id)}">
      <div class="st-up-h"><a class="st-up-t" href="${esc(cgHref(key, c.id))}"><b>${esc(c.name)}</b></a> ${mChip(c.state, c.stateLabel)}</div>
      <div class="st-up-r">${esc(`${c.members.length} members · feeds ${c.feedsTags.length ? c.feedsTags.join(', ') : 'nothing drawn'}`)}</div>
      <ul class="st-plist">${members}</ul>
      ${arr(c.warnings).map((w) => `<p class="st-warn">${esc(w)}</p>`).join('')}
      <div class="st-up-a">${btn('Open', { href: cgHref(key, c.id), small: true })}${c.state === 'rejected' ? '' : btn('Add member…', { act: 'st:cg-add', data: { plant: key, cg: c.id }, small: true, kind: 'ghost' })}</div></li>`;
  }
  function viewToggle(key, view, canDraw, q) {
    const keep = { select: q.select, stage: q.stage, show: q.show };
    const d = canDraw
      ? `<a class="st-seg-b${view === 'drawing' ? ' on' : ''}" href="${esc(structHref(key, 'drawing', keep))}"${view === 'drawing' ? ' aria-current="true"' : ''}>Drawing</a>`
      : '<span class="st-seg-b is-off" aria-disabled="true" title="The sample plants have no drawing">Drawing</span>';
    const l = `<a class="st-seg-b${view !== 'drawing' ? ' on' : ''}" href="${esc(structHref(key, 'list', keep))}"${view !== 'drawing' ? ' aria-current="true"' : ''}>List</a>`;
    return `<nav class="st-seg" aria-label="View">${d}${l}</nav>`;
  }
  function stageSelect(key, view, s, q) {
    const opts = [`<option value="">Stage: All</option>`].concat(arr(s.stages).map((st) => { const v = st.key == null ? 'none' : st.key; return `<option value="${esc(v)}"${q.stage === v ? ' selected' : ''}>${esc(st.label)} (${st.upIds.length})</option>`; }));
    return `<select class="st-stage" data-act="st:stage" data-plant="${esc(key)}" data-view="${esc(view)}" aria-label="Stage">${opts.join('')}</select>`;
  }
  /* counts for the filter chips: what each filter would show */
  function filterCounts(key, s) {
    const under = arr(vcall('structureChanges', [{ plant: key }], [])).filter((x) => x.underneath).length;
    return { shared: s.counts.sharedEquipment || 0, unclassified: s.counts.unclassified || 0, underneath: under, proposed: s.counts.proposed || 0 };
  }
  function listView(key, s, q, sel, view) {
    const show = q.show || 'all'; const out = [];
    const target = /^participation\.(.+)$/.exec(String(q.f || '')); const tgt = target ? target[1] : (sel && sel.kind === 'eq' ? sel.id : null);
    const stageWanted = q.stage ? (q.stage === 'none' ? null : q.stage) : undefined;
    const inStage = (u) => stageWanted === undefined || (u.stage || null) === stageWanted;
    if (show === 'all' || show === 'unclassified') {
      const sp = passOf(key, 'all'); const g = sp ? sp.groups.find((x) => x.key === 'unclassified') : null;
      if (g && g.rows.length) out.push(part('The unclassified equipment', () => unclassifiedCard(key, g.rows, { target: tgt })));
      else if (show === 'unclassified') out.push(empty('Nothing is unclassified: every piece of equipment takes part in a unit process or is marked not part of any.'));
    }
    if (show === 'underneath') {
      const ch = arr(vcall('structureChanges', [{ plant: key }], [])).filter((x) => x.underneath);
      out.push(ch.length ? card({ title: `Changed underneath (${ch.length})`, sub: 'The plant graph moved under these edits since they were made. Check each one.', tone: 'warn', body: U.list(ch.map((x) => ({ title: x.line, sub: [x.detail, x.note].filter(Boolean).join(' · '), href: x.href, chips: [mChip('underneath')] }))) })
        : empty('No edit has had the plant graph change under it.'));
    }
    if (show === 'all' || show === 'shared' || show === 'proposed') {
      const only = show === 'shared' ? (x) => x.shared : show === 'proposed' ? (x) => x.state === 'proposed' : null;
      arr(s.stages).forEach((st) => {
        const us = st.upIds.map((id) => s.ups.find((u) => u.id === id)).filter(Boolean).filter(inStage)
          .filter((u) => !only || u.participants.some(only) || (show === 'proposed' && u.typeState === 'proposed'));
        if (!us.length) return;
        out.push(U.section(st.label, `<ul class="st-ups">${us.map((u) => upRow(key, u, { sel, only, target: tgt, view, q })).join('')}</ul>`, { cls: 'st-stage-sec', id: `st-stage-${st.key || 'none'}` }));
      });
    }
    if ((show === 'all' || show === 'proposed') && stageWanted === undefined) {
      const cs = arr(s.cgs).filter((c) => show !== 'proposed' || c.state === 'proposed');
      if (cs.length || show === 'all') {
        out.push(U.section(`Control groups (${cs.length})`, cs.length ? `<ul class="st-ups">${cs.map((c) => cgRow(key, c, { sel })).join('')}</ul>` : empty('No control group yet.'), {
          sub: 'Equipment that runs together under one setpoint. Tasks stay on each member.', cls: 'st-cg-sec', id: 'st-cgs',
          actions: [btn('Make control group…', { act: 'st:cg-make', data: { plant: key }, small: true })],
        }));
      }
    }
    if (show === 'all' && stageWanted === undefined) {
      const np = arr(s.notPart);
      if (np.length) {
        const rows = np.map((id) => { const n = nodeOf(key, id) || { tag: id, name: '', typeName: '' }; const d = notPartNote(key, id) || {}; return `<li class="st-urow${tgt === id ? ' is-target' : ''}" id="st-np-${esc(id)}"><div class="st-urow-m"><div class="st-urow-t"><a href="${esc(eqHref(key, id))}">${esc(n.tag)}</a> · ${esc(n.name)} · ${esc(n.typeName)}</div><div class="st-urow-s">${esc(d.note ? d.note : 'Marked not part of any unit process.')}${d.by ? ` · ${esc(d.by)}` : ''}</div></div><div class="st-urow-a">${btn('Place in…', { act: 'st:place', data: { plant: key, eq: id }, small: true })}</div></li>`; }).join('');
        out.push(U.section(`Outside any unit process (${np.length})`, `<ul class="st-urows st-outside">${rows}</ul>`, { sub: 'Marked not part of any unit process.', id: 'st-outside' }));
      }
    }
    out.push('<p class="st-foot">Missing a basin? Correct the survey, then re-run identification.</p>');
    return out.join('');
  }

  /* ── the drawing ─────────────────────────────────────────────────────────────────────────────────────── */
  const ZOOMS = [0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.7, 1];
  function zoomOf(key, dr) { const z = STATE.zoom[key]; return z == null ? (dr.zoom || 0.25) : z; }
  function wrapWords(text, maxChars) {
    const words = String(text || '').split(/\s+/); const lines = []; let cur = '';
    words.forEach((w) => { if (!cur) cur = w; else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines.slice(0, 3);
  }
  function clip(cx, cy, hw, hh, dx, dy) {
    if (!dx && !dy) return [cx, cy];
    const s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return [cx + dx * s, cy + dy * s];
  }
  /* which node gets which outline for the current selection */
  function drawMarks(key, sel, nodes, stage) {
    const marks = {}; const dimAll = !!sel;
    const set = (id, cls) => { marks[id] = (marks[id] ? marks[id] + ' ' : '') + cls; };
    const mul = multi(key);
    if (sel && sel.kind === 'up') {
      const u = upOf(key, sel.id);
      if (u) {
        set(u.id, 'is-sel');
        u.participants.forEach((x) => { set(x.eqId, `is-p is-p-${x.state}${x.shared ? ' is-shared' : ''}`); if (pendHas(key, 'remove', u.id, x.eqId)) set(x.eqId, 'is-removing'); });
        pendFor(key, u.id).filter((x) => x.op === 'add').forEach((x) => set(x.eqId, 'is-p is-adding'));
      }
    } else if (sel && sel.kind === 'eq') {
      set(sel.id, 'is-sel');
      const m = membership(key, sel.id);
      if (m) m.participatesIn.forEach((x) => set(x.upId, `is-p is-p-${x.state}`));
      if (m) m.controlGroups.forEach((g) => { const c = cgOf(key, g.cgId); if (c) c.memberIds.forEach((id) => { if (id !== sel.id) set(id, 'is-mate'); }); });
      mul.forEach((id) => { if (id !== sel.id) set(id, 'is-multi'); });
    } else if (sel && sel.kind === 'cg') {
      const c = cgOf(key, sel.id);
      if (c) { c.members.forEach((m) => set(m.eqId, `is-p is-p-${m.state}`)); c.feeds.forEach((id) => set(id, 'is-feed')); }
    }
    if (dimAll) nodes.forEach((n) => { if (!marks[n.id]) marks[n.id] = 'is-dim'; });
    /* a stage chosen and nothing selected: that stage's unit processes and what takes part in them stay lit */
    if (!sel && stage !== undefined) {
      const lit = new Set(); ups(key).filter((u) => (u.stage || null) === stage).forEach((u) => { lit.add(u.id); u.participants.forEach((x) => lit.add(x.eqId)); });
      nodes.forEach((n) => { if (!lit.has(n.id)) marks[n.id] = 'is-dim'; });
    }
    return marks;
  }
  function nodeSvg(key, n, cls, extra) {
    const cx = n.x + n.w / 2; const cy = n.y + n.h / 2; const up = n.kind === 'up';
    const tags = [];
    if (/\bis-p-added\b/.test(cls)) tags.push('Added');
    if (/\bis-shared\b/.test(cls)) tags.push('shared');
    if (/\bis-adding\b/.test(cls)) tags.push('Adding');
    if (/\bis-removing\b/.test(cls)) tags.push('Removing');
    let label;
    if (up) {
      const lines = wrapWords(n.typeName, Math.max(8, Math.floor(n.w / 17)));
      const y0 = cy - (lines.length * 34) / 2 + 4;
      label = `<text class="st-t1" x="${cx}" y="${y0}" font-size="48">${esc(n.tag)}</text>` + lines.map((l, i) => `<text class="st-t2" x="${cx}" y="${y0 + 44 + i * 34}" font-size="30">${esc(l)}</text>`).join('');
    } else if (n.w < 90) {
      label = `<text class="st-t3" x="${cx}" y="${n.y + n.h + 26}" font-size="24">${esc(n.tag)}</text>`;
    } else {
      const fs = Math.max(18, Math.min(34, Math.floor(n.w / (String(n.tag).length * 0.62))));
      label = `<text class="st-t3" x="${cx}" y="${cy + fs / 3}" font-size="${fs}">${esc(n.tag)}</text>`;
    }
    const tagHtml = tags.length ? `<text class="st-tag" x="${cx}" y="${n.y - 14}" font-size="26">${esc(tags.join(' · '))}</text>` : '';
    const desc = `${n.tag} · ${n.typeName}${up ? ', unit process' : ''}${tags.length ? `, ${tags.join(', ')}` : ''}${extra ? `, ${extra}` : ''}`;
    return `<g class="st-n st-n-${up ? 'up' : 'eq'}${cls ? ' ' + cls : ''}" data-act="st:node" data-plant="${esc(key)}" data-id="${esc(n.id)}" data-kind="${up ? 'up' : 'eq'}" id="st-n-${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(desc)}"><title>${esc(desc)}</title><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}"${up ? ' rx="24"' : ''}/>${label}${tagHtml}</g>`;
  }
  function drawingSvg(key, dr, sel, q) {
    const nodes = arr(dr.nodes); const byId = {}; nodes.forEach((n) => { byId[n.id] = n; });
    const vb = arr(dr.viewBox); const z = zoomOf(key, dr);
    const stage = q && q.stage ? (q.stage === 'none' ? null : q.stage) : undefined;
    const marks = drawMarks(key, sel, nodes, stage); const dimming = !!sel || stage !== undefined;
    const views = {}; nodesOf(key).forEach((v) => { views[v.id] = v; });
    const extra = (n) => { const v = views[n.id]; if (!v || n.kind === 'up') return ''; return v.placement === 'unclassified' ? 'unclassified' : v.placement === 'notpart' ? 'not part of any unit process' : ''; };
    const cls = (n) => { const v = views[n.id]; const base0 = marks[n.id] || ''; const plc = n.kind === 'eq' && v ? (v.placement === 'unclassified' ? 'is-unclassified' : v.placement === 'notpart' ? 'is-notpart' : '') : ''; return [base0, dimming ? '' : plc].filter(Boolean).join(' '); };
    const links = arr(dr.links).map(([a, b]) => {
      const A = byId[a]; const B = byId[b]; if (!A || !B || a === b) return '';
      const ax = A.x + A.w / 2; const ay = A.y + A.h / 2; const bx = B.x + B.w / 2; const by = B.y + B.h / 2;
      const p1 = clip(ax, ay, A.w / 2, A.h / 2, bx - ax, by - ay); const p2 = clip(bx, by, B.w / 2, B.h / 2, ax - bx, ay - by);
      const dim = dimming && (/is-dim/.test(marks[a] || 'is-dim') || /is-dim/.test(marks[b] || 'is-dim'));
      return `<line class="st-pipe${dim ? ' is-dim' : ''}" x1="${Math.round(p1[0])}" y1="${Math.round(p1[1])}" x2="${Math.round(p2[0])}" y2="${Math.round(p2[1])}" marker-end="url(#st-arrow)"/>`;
    }).join('');
    const zones = arr(dr.points).map((pt) => `<text class="st-zone" x="${pt.x + (pt.w || 0) / 2}" y="${pt.y + (pt.h || 0) / 2 + 9}" font-size="28">${esc(pt.label)}</text>`).join('');
    const upsN = nodes.filter((n) => n.kind === 'up').length;
    const size = z === 'fit' ? 'class="st-svg is-fit"' : `class="st-svg" width="${Math.round(vb[2] * z)}" height="${Math.round(vb[3] * z)}"`;
    return `<svg ${size} viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="${esc(`The plant graph: ${plural(upsN, 'unit process', 'unit processes')} and ${pieces(nodes.length - upsN)}`)}">
      <defs><marker id="st-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="st-arrowhead"/></marker></defs>
      <g class="st-pipes">${links}</g><g class="st-zones">${zones}</g><g class="st-nodes">${nodes.map((n) => nodeSvg(key, n, cls(n), extra(n))).join('')}</g></svg>`;
  }
  function drawingView(key, dr) {
    const z = zoomOf(key, dr);
    const i = ZOOMS.indexOf(z);
    const tools = `<div class="st-zoom" role="group" aria-label="Zoom">${btn('Fit', { act: 'st:zoom', data: { plant: key, z: 'fit' }, small: true, kind: z === 'fit' ? 'secondary' : 'ghost' })}${btn('−', { act: 'st:zoom', data: { plant: key, z: 'out' }, small: true, kind: 'ghost', title: 'Zoom out', disabled: z !== 'fit' && i === 0 })}${btn('+', { act: 'st:zoom', data: { plant: key, z: 'in' }, small: true, kind: 'ghost', title: 'Zoom in', disabled: z !== 'fit' && i === ZOOMS.length - 1 })}</div>`;
    const legend = '<p class="st-legend"><span class="st-lg st-lg-prop"></span>Proposed <span class="st-lg st-lg-conf"></span>Confirmed <span class="st-lg st-lg-add"></span>Added by hand <span class="st-lg st-lg-unc"></span>Unclassified</p>';
    return `<div class="st-draw">${tools}${legend}</div><div class="st-frame" tabindex="0" role="region" aria-label="The drawing; it scrolls sideways inside this frame">${drawingSvg(key, dr, STATE.view[key] ? STATE.view[key].sel : null, STATE.view[key] ? STATE.view[key].q : {})}</div>`;
  }

  /* ── the side panel (the page's aside) ────────────────────────────────────────────────────────────────── */
  function hint(view) {
    return view === 'drawing'
      ? '<p class="st-hint">Click a unit process to outline what takes part in it. Shift-click (or Ctrl-click, ⌘-click) a piece of equipment to add it or take it out. Nothing changes until you save.</p>'
      : '';
  }
  function upPanel(key, u, view) {
    const pd = pendFor(key, u.id); const live = isLive(key);
    const adds = pd.filter((x) => x.op === 'add').map((x) => tagOf(key, x.eqId)); const rems = pd.filter((x) => x.op === 'remove').map((x) => tagOf(key, x.eqId));
    const pv = pd.length ? preview(key, pd) : null; const blocked = live && !String(pend(key).note || '').trim();
    const pending = pd.length ? `<div class="st-panel-pend">${adds.length ? `<p><b>Adding:</b> ${esc(adds.join(', '))}</p>` : ''}${rems.length ? `<p><b>Removing:</b> ${esc(rems.join(', '))}</p>` : ''}${previewLines(pv)}${reasonField(key, 'pending', pend(key).note)}<div class="st-pending-a">${btn('Cancel', { act: 'st:pend-cancel', data: { plant: key }, kind: 'ghost', small: true })}${btn('Save', { act: 'st:pend-save', data: { plant: key }, kind: 'primary', small: true, disabled: blocked, title: blocked ? 'Give a reason first: this plant is Live.' : null })}</div></div>` : '';
    const body = `<p class="st-quiet">Stage: ${esc(u.stageLabel)} · ${mChip(u.typeState, u.typeStateLabel)}</p>
      <div class="st-panel-p">${participantsBlock(key, u, {})}</div>${pending}
      <div class="st-panel-a">${btn('Add equipment…', { act: 'st:add-eq', data: { plant: key, up: u.id }, small: true })}${btn('Open the unit process', { href: upHref(key, u.id), small: true, kind: 'ghost' })}${btn(`${u.tag}'s Tasks`, { href: upHref(key, u.id, 'tasks'), small: true, kind: 'ghost' })}</div>${hint(view)}`;
    return card({ title: `${u.tag} · ${u.typeName}`, body, cls: 'st-panel', id: 'st-panel' });
  }
  function eqPanel(key, n, view) {
    const m = membership(key, n.id) || { participatesIn: [], controlGroups: [], placement: null };
    const ins = m.participatesIn.map((x) => x.tag);
    const line = ins.length ? `Takes part in ${ins.join(', ')}` : m.placement === 'notpart' ? 'Not part of any unit process' : 'Unclassified: no unit process takes it in';
    const cgLine = m.controlGroups.length ? ` · Control group: ${m.controlGroups.map((g) => g.name).join(', ')}` : '';
    const mul = multi(key).filter((id) => id !== n.id);
    const canCg = CG_CODES.includes(n.code) && !m.controlGroups.length;
    const pick = canCg ? `<div class="st-panel-cg">${mul.length ? `<p><b>For a control group:</b> ${esc([n.tag].concat(mul.map((id) => tagOf(key, id))).join(', '))}</p>` : ''}<div class="st-pending-a">${btn('Make control group', { act: 'st:cg-make', data: { plant: key, eqs: [n.id].concat(mul).join(',') }, small: true, kind: mul.length ? 'primary' : 'secondary', disabled: !mul.length, title: mul.length ? null : 'Shift-click more blowers or pumps on the drawing first.' })}${mul.length ? btn('Clear', { act: 'st:multi-clear', data: { plant: key }, small: true, kind: 'ghost' }) : ''}</div></div>` : '';
    const body = `<p>${esc(line + cgLine)}</p><p class="st-quiet">${esc(n.name)} · ${esc(n.typeName)}</p>
      <div class="st-panel-a">${btn('Place in…', { act: 'st:place', data: { plant: key, eq: n.id }, small: true })}${m.placement === 'unclassified' ? btn('Not part of any unit process', { act: 'st:notpart', data: { plant: key, eq: n.id }, small: true, kind: 'ghost' }) : ''}${btn('Open the equipment page', { href: eqHref(key, n.id), small: true, kind: 'ghost' })}</div>${pick}${view === 'drawing' && canCg ? '<p class="st-hint">Shift-click more blowers or pumps to make a control group with this one.</p>' : ''}`;
    return card({ title: `${n.tag} · ${n.typeName}`, body, cls: 'st-panel', id: 'st-panel' });
  }
  function cgPanel(key, c) {
    const body = `<p class="st-quiet">${mChip(c.state, c.stateLabel)}</p><p>Feeds: ${c.feedsTags.length ? esc(c.feedsTags.join(', ')) : 'nothing drawn'}</p>
      <p>Members: ${c.members.map((m) => `<a href="${esc(eqHref(key, m.eqId))}">${esc(m.tag)}</a>`).join(', ')}</p>${arr(c.warnings).map((w) => `<p class="st-warn">${esc(w)}</p>`).join('')}
      <div class="st-panel-a">${btn('Open the control group', { href: cgHref(key, c.id), small: true })}${c.state === 'rejected' ? '' : btn('Add member…', { act: 'st:cg-add', data: { plant: key, cg: c.id }, small: true, kind: 'ghost' })}</div>`;
    return card({ title: c.name, body, cls: 'st-panel', id: 'st-panel' });
  }
  function summaryPanel(key, s, view) {
    const sp = passOf(key, 'all');
    const passLine = s.done ? `Structure pass confirmed ${fmt(s.confirmedAt)}` : `Structure pass open: ${sp ? sp.counts.toReview : 0} to review`;
    const body = `<p>${esc(s.summary || '')}</p><p class="st-quiet">${esc(passLine)}</p><div class="st-panel-a">${btn(s.done ? 'Open the structure pass' : 'Review the structure pass', { href: passHref(key), small: true, kind: s.done ? 'secondary' : 'primary' })}</div>${hint(view)}`;
    return card({ title: 'Structure', body, cls: 'st-panel', id: 'st-panel' });
  }
  function aside(key, s, sel, view) {
    if (sel && sel.kind === 'up') { const u = upOf(key, sel.id); if (u) return upPanel(key, u, view); }
    if (sel && sel.kind === 'eq') { const n = nodeOf(key, sel.id); if (n && !isUpNode(key, n.id)) return eqPanel(key, n, view); if (n) { const u = upOf(key, n.id); if (u) return upPanel(key, u, view); } }
    if (sel && sel.kind === 'cg') { const c = cgOf(key, sel.id); if (c) return cgPanel(key, c); }
    return summaryPanel(key, s, view);
  }

  function structurePage(params, forceView) {
    const key = params && params.plant; const p = plantOf(key); if (!p) return notFound(key);
    const q = Object.assign({}, (params && params._q) || {});
    if (q.filter && !q.show) q.show = q.filter;
    const s = structOf(key);
    if (!s) return frame(key, empty('This plant has no plant graph yet.'), { crumbs: [{ label: 'Structure' }], title: 'Structure' });
    const dr = vcall('drawing', [key], null);
    const narrow = (W.innerWidth || 1280) < 640;
    const want = forceView || (params && params.view) || 'list';
    const view = want === 'drawing' && dr && !narrow ? 'drawing' : 'list';
    const sel = parseSel(q.select);
    STATE.view[key] = { view, sel, q };
    if (!sel || sel.kind !== 'eq') STATE.multi[key] = [];
    const sp = passOf(key, 'all');
    const sub = `From the plant graph · identification run ${fmt(s.runAt)}${s.done ? ` · structure confirmed ${fmt(s.confirmedAt)}` : ` · structure pass open: ${sp ? sp.counts.toReview : 0} to review`}`;
    const fc = filterCounts(key, s); const show = q.show || 'all';
    const keep = (o) => Object.assign({ select: q.select, stage: q.stage }, o);
    const chips = filters([
      { label: 'All', href: structHref(key, view, keep({ show: null })), on: show === 'all' },
      { label: 'Shared', count: fc.shared, href: structHref(key, view, keep({ show: 'shared' })), on: show === 'shared' },
      { label: 'Unclassified', count: fc.unclassified, href: structHref(key, view, keep({ show: 'unclassified' })), on: show === 'unclassified' },
      { label: 'Changed underneath', count: fc.underneath, href: structHref(key, view, keep({ show: 'underneath' })), on: show === 'underneath' },
      { label: 'Proposed', count: fc.proposed, href: structHref(key, view, keep({ show: 'proposed' })), on: show === 'proposed' },
    ]);
    const toolbar = `<div class="st-toolbar">${viewToggle(key, view, !!dr, q)}${stageSelect(key, view, s, q)}${btn('Re-run identification', { act: 'st:rerun', data: { plant: key }, small: true, kind: 'ghost' })}</div>${chips}`;
    const back = q.from === 'review' ? `<div class="banner st-back"><div class="banner-t"><a href="${esc(passHref(key))}">← Back to review</a> · ${esc(`${sp ? sp.counts.toReview : 0} left in the structure pass`)}</div></div>` : '';
    const narrowNote = want === 'drawing' && dr && narrow ? note('The drawing needs a wider screen. The list below holds the same structure.', 'quiet') : '';
    const sampleNote = want === 'drawing' && !dr ? note('The sample plants have no drawing. The list below holds the same structure.', 'quiet') : '';
    const main = view === 'drawing' ? part('The drawing', () => drawingView(key, dr)) + (show === 'all' ? '' : part('The list', () => listView(key, s, q, sel, view))) : part('The list', () => listView(key, s, q, sel, view));
    const body = back + toolbar + narrowNote + sampleNote + main + part('The changes to save', () => pendingBar(key));
    return frame(key, body, { crumbs: [{ label: 'Structure' }], title: 'Structure', sub, aside: part('The side panel', () => aside(key, s, sel, view)), cls: 'st-structure' });
  }

  /* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
     The control-group page (p/:plant/cg/:id)
     ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function cgPage(params) {
    const key = params && params.plant; const p = plantOf(key); if (!p) return notFound(key);
    const c = cgOf(key, params.id);
    if (!c) return frame(key, empty('There is no such control group at this plant.', btn('Structure', { href: structHref(key, 'list') })), { crumbs: [{ label: 'Structure', href: structHref(key, 'list') }, { label: 'Not found' }], title: 'Control group' });
    const dr = vcall('drawing', [key], null);
    const members = U.table({
      cols: [
        { label: 'Tag', render: (m) => H(`<a href="${esc(eqHref(key, m.eqId))}">${esc(m.tag)}</a> ${mChip(m.state)}`) },
        { label: 'Equipment type', key: 'typeName' },
        { label: 'Running', render: (m) => (m.running ? 'Running' : 'Not running') },
        { label: 'Participates in', render: (m) => { const mm = membership(key, m.eqId); const l = mm ? mm.participatesIn : []; return l.length ? H(l.map((x) => `<a href="${esc(upHref(key, x.upId))}">${esc(x.tag)}</a>`).join(', ')) : 'No unit process'; } },
      ],
      rows: c.members, empty: 'No members.',
    });
    const feeds = c.feeds.length ? c.feeds.map((id) => (isUpNode(key, id) ? `<a href="${esc(upHref(key, id))}">${esc(tagOf(key, id))}</a>` : `<a href="${esc(eqHref(key, id))}">${esc(tagOf(key, id))}</a>`)).join(', ') : 'nothing drawn';
    const work = arr(c.memberWork);
    const workHtml = work.length ? `<ul class="st-work">${work.map((w) => `<li>${esc(w.text)}</li>`).join('')}</ul>` : '<p class="st-quiet">Its members carry no Task yet.</p>';
    const editHref = structHref(key, dr ? 'drawing' : 'list', { select: `cg:${c.id}` });
    const body = card({ title: 'Members', body: members + `<p class="st-feeds">Feeds: ${feeds}</p><p class="st-quiet">${esc(c.setpointText || '')}</p>` })
      + card({ title: 'Work on the members', sub: 'Worked out from the Tasks each member carries.', body: workHtml + '<p class="st-quiet">Tasks are filed on each member, never on the group.</p>' })
      + (arr(c.warnings).length ? card({ title: 'Worth a second look', tone: 'warn', body: c.warnings.map((w) => `<p class="st-warn">${esc(w)}</p>`).join('') }) : '')
      + `<div class="st-cg-a">${btn(dr ? 'Edit on drawing' : 'Edit in the structure list', { href: editHref, kind: 'primary', small: true })}${c.state === 'proposed' && !vcall('structureDone', [key], true) ? btn('Review it in the structure pass', { href: passHref(key, 'cgs'), small: true, kind: 'ghost' }) : ''}</div>`;
    const sub = c.why || '';
    return frame(key, body, { crumbs: [{ label: 'Structure', href: structHref(key, 'list') }, { label: c.name }], title: c.name, sub, chips: [chip('Control group', { tone: 'info' }), mChip(c.state, c.stateLabel)], cls: 'st-cgpage' });
  }

  /* ── aliases ───────────────────────────────────────────────────────────────────────────────────────────── */
  function reviewPage(params) {
    const key = params && params.plant;
    if (!plantOf(key)) return notFound(key);
    if (!vcall('structureDone', [key], false)) return passPage(params);
    const m = call(() => U.match(`#/p/${key}/review/bindings`), null);
    if (m && m.route && m.pattern !== 'p/:plant/review' && m.pattern !== 'p/:plant/review/structure' && typeof m.route.raw === 'function') {
      const out = call(() => m.route.raw(Object.assign({}, m.params, { _q: (params && params._q) || {}, _path: `p/${key}/review/bindings` })), null);
      if (typeof out === 'string' && out) return out;
    }
    return passPage(params);
  }

  /* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
     Components for the object, list and work pages
     ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function editLink(key, select) {
    const dr = vcall('drawing', [key], null);
    return btn(dr ? 'Edit on drawing' : 'Edit in the structure list', { href: structHref(key, dr ? 'drawing' : 'list', { select }), small: true });
  }
  function participantsCard(key, upId) {
    const u = upOf(key, upId); if (!u) return '';
    const n = u.participants.length;
    const roles = []; const at = {};
    u.participants.forEach((x) => { const k = x.roleLabel || 'Other'; if (!(k in at)) { at[k] = roles.length; roles.push({ label: k, items: [] }); } roles[at[k]].items.push(x); });
    const rolesHtml = roles.map((r) => `<div class="st-role"><span class="st-role-l">${esc(r.label)}</span><ul class="st-plist st-plist-v">${r.items.map((x) => {
      const also = arr(x.alsoIn).map((a) => chip(`Also in ${a.tag}`, { href: upHref(key, a.upId), tone: 'muted' })).join(' ');
      const cg = x.cgId ? (() => { const c = cgOf(key, x.cgId); return c ? chip(`Control group: ${c.name}`, { href: cgHref(key, c.id), tone: 'muted' }) : ''; })() : '';
      return `<li class="st-p"><a href="${esc(eqHref(key, x.eqId))}">${esc(x.tag)}</a> ${mChip(x.state, x.stateLabel)} ${also} ${cg}</li>`;
    }).join('')}</ul></div>`).join('');
    const rem = arr(u.removed).length ? `<p class="st-quiet">Removed: ${u.removed.map((x) => `<s>${esc(x.tag)}</s>`).join(', ')}</p>` : '';
    const ss = arr(vcall('sensors', [key, u.id], [])).filter((s) => !s.nextPhase);
    const sens = ss.length ? `<p class="st-sens">Sensors: ${ss.map((s) => `<a href="${esc(sensorHref(key, s.id))}">${esc(s.tag || s.name)}</a>`).join(', ')}</p>` : '<p class="st-quiet">No sensors on it.</p>';
    return card({
      title: 'Participants', sub: n ? `${pieces(n)} ${n === 1 ? 'takes' : 'take'} part in ${u.tag}` : `No equipment takes part in ${u.tag}`,
      body: (rolesHtml || '<p class="st-quiet">No participants</p>') + rem + sens, foot: editLink(key, `up:${u.id}`), cls: 'st-partcard',
    });
  }
  function participatesCard(key, eqId) {
    const m = membership(key, eqId); const n = nodeOf(key, eqId); if (!m || !n) return '';
    const rows = m.participatesIn.map((x) => ({ up: x, _cls: '' }));
    const tbl = rows.length ? U.table({
      cols: [
        { label: 'Unit process', render: (r) => H(`<a href="${esc(upHref(key, r.up.upId))}">${esc(r.up.tag)}</a> · ${esc(r.up.typeName)}`) },
        { label: 'Role', render: (r) => r.up.roleLabel },
        { label: 'State', render: (r) => H(mChip(r.up.state, r.up.stateLabel)) },
        { label: 'Why', render: (r) => r.up.why || '' },
      ], rows,
    }) : '';
    let place = '';
    if (m.placement === 'unclassified') place = `<p class="st-warn">Unclassified: no unit process takes it in. It blocks go live until it is placed in a unit process or marked not part of any unit process.</p><div class="st-panel-a">${btn('Place in…', { act: 'st:place', data: { plant: key, eq: eqId }, small: true, kind: 'primary' })}${btn('Not part of any unit process', { act: 'st:notpart', data: { plant: key, eq: eqId }, small: true, kind: 'ghost' })}</div>`;
    else if (m.placement === 'notpart') { const d = notPartNote(key, eqId) || {}; place = `<p>Not part of any unit process${d.note ? `: ${esc(d.note)}` : ''}</p>`; }
    const cgsL = m.controlGroups.length ? `<p>Control group: ${m.controlGroups.map((g) => `<a href="${esc(cgHref(key, g.cgId))}">${esc(g.name)}</a>`).join(', ')}</p>` : '<p class="st-quiet">Control group: none</p>';
    const rem = arr(m.removedFrom).length ? `<p class="st-quiet">Removed from ${m.removedFrom.map((x) => `${esc(x.tag)}${x.note ? ` (${esc(x.note)})` : ''}`).join(', ')}</p>` : '';
    return card({ title: 'Participates in', body: tbl + place + cgsL + rem, foot: editLink(key, `eq:${eqId}`), cls: 'st-partcard', id: 'participation' });
  }
  function participatesChips(key, eqId) {
    const m = membership(key, eqId); if (!m) return [];
    const out = [];
    if (m.participatesIn.length) out.push(`<span class="chip chip-info st-pchip">Participates in: ${m.participatesIn.map((x) => `<a href="${esc(upHref(key, x.upId))}">${esc(x.tag)}</a>`).join(', ')}</span>`);
    else if (m.placement === 'notpart') out.push(chip('Not part of any unit process', { tone: 'muted' }));
    else if (m.placement === 'unclassified') out.push(chip('Unclassified', { tone: 'bad', href: passHref(key, 'unclassified') }));
    m.controlGroups.forEach((g) => out.push(chip(`Control group: ${g.name}`, { href: cgHref(key, g.cgId), tone: 'muted' })));
    return out;
  }
  function subjectChip(key, subject) {
    let s = subject;
    if (!s || typeof s !== 'object' || !s.kind || (s.kind !== 'plant' && !s.tag)) s = vcall('subjectOf', [key, subject], null) || (s && typeof s === 'object' ? s : null);
    if (!s) return '';
    if (s.kind === 'plant') return chip('The plant', { tone: 'muted', href: base(key), cls: 'st-subj st-subj-plant' });
    const href = s.href || (s.kind === 'up' ? upHref(key, s.id) : eqHref(key, s.id));
    return chip(`${s.tag || tagOf(key, s.id)} · ${s.kind === 'up' ? 'unit process' : 'equipment'}`, { tone: s.kind === 'up' ? 'info' : 'muted', href, cls: `st-subj st-subj-${s.kind}` });
  }
  function stageCrumb(key, nodeId) {
    let u = null;
    if (isUpNode(key, nodeId)) u = upOf(key, nodeId);
    else { const m = membership(key, nodeId); const first = m && m.participatesIn[0]; u = first ? upOf(key, first.upId) : null; }
    if (!u) return null;
    const stage = u.stage || null;
    return { label: u.stageLabel || 'No stage', href: stage ? structHref(key, 'list', { stage }) : structHref(key, 'list'), stage };
  }

  /* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
     Modals: Place in…, Change type, Reject, Not part (Live), Add equipment, control groups
     ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function mdChanges(dlg) {
    const k = dlg.plant;
    if (dlg.kind === 'place') return dlg.eqIds.flatMap((e) => [...dlg.upIds].map((u) => ({ op: 'add', upId: u, eqId: e })));
    if (dlg.kind === 'addEq') return [...dlg.eqIds].map((e) => ({ op: 'add', upId: dlg.upId, eqId: e }));
    if (dlg.kind === 'type') return dlg.typeId && dlg.typeId !== dlg.current ? [{ op: 'type', upId: dlg.upId, typeId: dlg.typeId }] : [];
    if (dlg.kind === 'notpart') return dlg.eqIds.map((e) => ({ op: 'notpart', eqId: e }));
    if (dlg.kind === 'reject') {
      const sp = passOf(k, 'all'); const r = sp ? sp.groups.flatMap((g) => g.rows || []).find((x) => x.rowId === dlg.rowId) : null;
      if (!r) return [];
      return r.kind === 'cg' ? [{ op: 'cgreject', cgId: r.cgId }] : r.eqIds.map((e) => ({ op: 'remove', upId: r.upId, eqId: e }));
    }
    if (dlg.kind === 'cgMake') return [...dlg.eqIds].length >= 2 ? [{ op: 'cgmake', cgId: '_new', eqIds: [...dlg.eqIds], name: dlg.name || '' }] : [];
    if (dlg.kind === 'cgAdd' || dlg.kind === 'cgRemove') { const c = cgOf(k, dlg.cgId); if (!c) return []; const next = dlg.kind === 'cgAdd' ? c.memberIds.concat([...dlg.eqIds]) : c.memberIds.filter((x) => x !== dlg.eqId); return [{ op: 'cgedit', cgId: dlg.cgId, eqIds: next }]; }
    return [];
  }
  function mdReady(dlg) {
    const live = isLive(dlg.plant); const noted = !!String(dlg.note || '').trim();
    if (live && !noted) return false;
    if (dlg.kind === 'place') return dlg.upIds.size > 0;
    if (dlg.kind === 'addEq' || dlg.kind === 'cgAdd') return dlg.eqIds.size > 0;
    if (dlg.kind === 'cgMake') return dlg.eqIds.size >= 2;
    if (dlg.kind === 'type') return !!dlg.typeId && dlg.typeId !== dlg.current;
    return true;
  }
  function mdTitle(dlg) {
    const k = dlg.plant;
    if (dlg.kind === 'place') return `Place ${joinAnd(dlg.eqIds.map((e) => tagOf(k, e)))} in a unit process`;
    if (dlg.kind === 'type') return `Change the type of ${tagOf(k, dlg.upId)}`;
    if (dlg.kind === 'reject') return 'Reject this proposal?';
    if (dlg.kind === 'notpart') return `Mark ${joinAnd(dlg.eqIds.map((e) => tagOf(k, e)))} not part of any unit process`;
    if (dlg.kind === 'addEq') return `Add equipment to ${tagOf(k, dlg.upId)}`;
    if (dlg.kind === 'cgMake') return 'Make a control group';
    if (dlg.kind === 'cgAdd') { const c = cgOf(k, dlg.cgId); return `Add a member to ${c ? c.name : 'the control group'}`; }
    if (dlg.kind === 'cgRemove') { const c = cgOf(k, dlg.cgId); return `Take ${tagOf(k, dlg.eqId)} out of ${c ? c.name : 'the control group'}?`; }
    return '';
  }
  function saveLabel(dlg) {
    const k = dlg.plant;
    if (dlg.kind === 'place') return dlg.upIds.size ? `Place in ${joinAnd([...dlg.upIds].map((u) => tagOf(k, u)))}` : 'Place in…';
    if (dlg.kind === 'type') { const t = arr(vcall('upTypeOptions', [k, dlg.upId], [])).find((x) => x.id === dlg.typeId); return dlg.typeId && dlg.typeId !== dlg.current && t ? `Change to ${t.name}` : 'Change type'; }
    if (dlg.kind === 'reject') return 'Reject';
    if (dlg.kind === 'notpart') return 'Mark not part of any unit process';
    if (dlg.kind === 'addEq') return dlg.eqIds.size ? `Add to ${tagOf(k, dlg.upId)}` : 'Add';
    if (dlg.kind === 'cgMake') return 'Make control group';
    if (dlg.kind === 'cgAdd') return 'Add';
    if (dlg.kind === 'cgRemove') return 'Take it out';
    return 'Save';
  }
  function checkList(name, items, chosen, act, dataKey) {
    return `<ul class="st-checks">${items.map((it) => `<li><label class="st-check"><input type="checkbox" name="${esc(name)}" value="${esc(it.id)}" data-act="${esc(act)}" data-${dataKey}="${esc(it.id)}"${chosen.has(it.id) ? ' checked' : ''}><span><b>${esc(it.label)}</b>${it.sub ? ` <small>${esc(it.sub)}</small>` : ''}</span></label></li>`).join('')}</ul>`;
  }
  function mdChoices(dlg) {
    const k = dlg.plant;
    if (dlg.kind === 'place') {
      const near = dlg.eqIds.length === 1 ? upsNextTo(k, dlg.eqIds[0]) : [...new Set(dlg.eqIds.flatMap((e) => upsNextTo(k, e)))];
      const us = ups(k); const item = (u) => ({ id: u.id, label: `${u.tag} · ${u.typeName}`, sub: u.stageLabel });
      const nearHtml = near.length ? `<h3 class="st-h">Next to it</h3>${checkList('st-up', near.map((id) => us.find((u) => u.id === id)).filter(Boolean).map(item), dlg.upIds, 'st:dlg-up', 'up')}` : '';
      const byStage = stagesOf().map((st) => { const l = us.filter((u) => (u.stage || null) === (st.key || null)); return l.length ? `<p class="st-sub">${esc(st.label)}</p>${checkList('st-up', l.map(item), dlg.upIds, 'st:dlg-up', 'up')}` : ''; }).join('');
      return `${nearHtml}<h3 class="st-h">All unit processes</h3>${byStage}`;
    }
    if (dlg.kind === 'type') {
      const u = upOf(k, dlg.upId); const opts = arr(vcall('upTypeOptions', [k, dlg.upId], []));
      const fact = u && u.drawnFact ? `<p class="st-fact">${esc(u.drawnFact)}</p>` : '';
      const groups = stagesOf().map((st) => { const l = opts.filter((o) => (o.stage || null) === (st.key || null)); return l.length ? `<p class="st-sub">${esc(st.label)}</p><div class="radios" role="radiogroup" aria-label="${esc(st.label)}">${l.map((o) => `<label class="radio${dlg.typeId === o.id ? ' on' : ''}"><input type="radio" name="st-type" value="${esc(o.id)}" data-act="st:dlg-type" data-type="${esc(o.id)}"${dlg.typeId === o.id ? ' checked' : ''}><span><b>${esc(o.name)}${o.proposed ? ' (proposed)' : ''}</b>${o.current && !o.proposed ? '<small>Its type now</small>' : ''}</span></label>`).join('')}</div>` : ''; }).join('');
      return fact + groups;
    }
    if (dlg.kind === 'reject') {
      const sp = passOf(k, 'all'); const r = sp ? sp.groups.flatMap((g) => g.rows || []).find((x) => x.rowId === dlg.rowId) : null;
      return r ? `<p><b>${esc(r.title)}</b>${r.upId ? ` in ${esc(tagOf(k, r.upId))}` : ''}</p><p class="st-quiet">${esc(r.why || '')}</p>` : '';
    }
    if (dlg.kind === 'notpart') return '<p>They will block nothing once marked, and stay listed under "Outside any unit process".</p>';
    if (dlg.kind === 'addEq') {
      const u = upOf(k, dlg.upId); const inIt = new Set(u ? u.participants.map((x) => x.eqId) : []);
      const all = nodesOf(k).filter((n) => n.kind !== 'up' && !isUpNode(k, n.id) && !inIt.has(n.id));
      const near = eqNextTo(k, dlg.upId).filter((id) => all.some((n) => n.id === id));
      const item = (n) => ({ id: n.id, label: `${n.tag} · ${n.typeName}`, sub: n.placement === 'unclassified' ? 'Unclassified' : n.placement === 'notpart' ? 'Not part of any unit process' : '' });
      const nearHtml = near.length ? `<h3 class="st-h">Next to it</h3>${checkList('st-eq', near.map((id) => all.find((n) => n.id === id)).map(item), dlg.eqIds, 'st:dlg-eq', 'eq')}` : '';
      return `${nearHtml}<h3 class="st-h">All equipment</h3>${checkList('st-eq', all.slice().sort((a, b) => String(a.tag).localeCompare(String(b.tag), 'en', { numeric: true })).map(item), dlg.eqIds, 'st:dlg-eq', 'eq')}`;
    }
    if (dlg.kind === 'cgMake' || dlg.kind === 'cgAdd') {
      const inCg = new Set(cgs(k).flatMap((c) => c.memberIds));
      const cand = nodesOf(k).filter((n) => CG_CODES.includes(n.code) && (!inCg.has(n.id) || dlg.eqIds.has(n.id)));
      const name = dlg.kind === 'cgMake' ? `<div class="field"><label class="field-l" for="st-cg-name">Name</label><input type="text" id="st-cg-name" data-act="st:dlg-name" data-live value="${esc(dlg.name || '')}" placeholder="Worked out from the members when left empty"></div>` : '';
      return `${name}<h3 class="st-h">Blowers and pumps not in a control group</h3>${cand.length ? checkList('st-eq', cand.map((n) => ({ id: n.id, label: `${n.tag} · ${n.typeName}`, sub: n.name })), dlg.eqIds, 'st:dlg-eq', 'eq') : '<p class="st-quiet">Every blower and pump here already runs in a control group.</p>'}`;
    }
    if (dlg.kind === 'cgRemove') return '<p>It keeps its Tasks; only the group changes.</p>';
    return '';
  }
  function mdLive(dlg) {
    const ch = mdChanges(dlg);
    const pv = ch.length ? preview(dlg.plant, ch) : null;
    let lines = '';
    if (dlg.kind === 'type' && !ch.length) lines = '<p class="st-quiet">Pick a type to see what it brings.</p>';
    else if (dlg.kind === 'place' && !ch.length) lines = '<p class="st-quiet">Choose at least one unit process.</p>';
    else if ((dlg.kind === 'addEq' || dlg.kind === 'cgAdd') && !ch.length) lines = '<p class="st-quiet">Choose at least one piece of equipment.</p>';
    else if (dlg.kind === 'cgMake' && !ch.length) lines = '<p class="st-quiet">Choose at least two blowers or pumps.</p>';
    else if (pv) lines = `<p class="st-sub">If you save</p>${previewLines(pv)}`;
    return lines + (dlg.error ? `<p class="field-e st-err" role="alert">${esc(dlg.error)}</p>` : '');
  }
  function mdBody(dlg) {
    const reason = reasonField(dlg.plant, 'dlg', dlg.note, { always: dlg.kind === 'reject' || dlg.kind === 'cgRemove' });
    return `<div class="st-dlg">${mdChoices(dlg)}<div class="st-dlg-live" aria-live="polite">${mdLive(dlg)}</div>${reason}</div>`;
  }
  function mdFoot(dlg) {
    const ready = mdReady(dlg); const live = isLive(dlg.plant);
    const why = !ready && live && !String(dlg.note || '').trim() ? 'Give a reason first: this plant is Live.' : null;
    const kind = dlg.kind === 'reject' || dlg.kind === 'cgRemove' ? 'danger' : 'primary';
    return btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(saveLabel(dlg), { act: 'st:dlg-save', kind, id: 'st-dlg-save', disabled: !ready, title: why });
  }
  function openMd(dlg) {
    STATE.dlg = Object.assign({ note: '', error: '' }, dlg);
    U.modal({ title: mdTitle(STATE.dlg), body: mdBody(STATE.dlg), foot: mdFoot(STATE.dlg), wide: dlg.kind === 'place' || dlg.kind === 'type' || dlg.kind === 'addEq', onClose: () => { STATE.dlg = null; } });
    return false;
  }
  /* refresh the parts of the open modal that change, without touching the fields a person is typing in */
  function paintMd(el) {
    const dlg = STATE.dlg; if (!dlg) return;
    const box = (el && el.closest && el.closest('.modal')) || (typeof document !== 'undefined' && document.querySelector ? document.querySelector('.modal') : null);
    if (!box || !box.querySelector) return;
    const live = box.querySelector('.st-dlg-live'); if (live) live.innerHTML = mdLive(dlg);
    const foot = box.querySelector('.modal-f'); if (foot) foot.innerHTML = mdFoot(dlg);
    const t = box.querySelector('.modal-t'); if (t) t.textContent = mdTitle(dlg);
  }
  function syncTwins(el, attrName, id, on) {
    const box = el && el.closest ? el.closest('.modal') : null; if (!box || !box.querySelectorAll) return;
    box.querySelectorAll(`input[data-${attrName}]`).forEach((i) => { if (i.getAttribute(`data-${attrName}`) === id) i.checked = on; });
  }
  function mdSave() {
    const dlg = STATE.dlg; if (!dlg) return false;
    const k = dlg.plant; const note = String(dlg.note || '').trim(); const o = { note };
    let r = null;
    if (dlg.kind === 'place') r = vcall('place', [k, dlg.eqIds.slice(), [...dlg.upIds], o], null);
    else if (dlg.kind === 'type') r = vcall('changeUpType', [k, dlg.upId, dlg.typeId, o], null);
    else if (dlg.kind === 'reject') r = vcall('rejectStructure', [k, dlg.rowId, o], null);
    else if (dlg.kind === 'notpart') r = vcall('notPart', [k, dlg.eqIds.slice(), o], null);
    else if (dlg.kind === 'addEq') r = vcall('editMembers', [k, [...dlg.eqIds].map((e) => ({ op: 'add', upId: dlg.upId, eqId: e })), o], null);
    else if (dlg.kind === 'cgMake') r = vcall('makeControlGroup', [k, [...dlg.eqIds], { name: String(dlg.name || '').trim(), note }], null);
    else if (dlg.kind === 'cgAdd') r = vcall('editControlGroup', [k, dlg.cgId, { add: [...dlg.eqIds] }, o], null);
    else if (dlg.kind === 'cgRemove') r = vcall('editControlGroup', [k, dlg.cgId, { remove: [dlg.eqId] }, o], null);
    if (!r || r.ok === false) { dlg.error = (r && r.error) || 'That did not work.'; paintMd(null); return false; }
    STATE.dlg = null; U.closeModal(true);
    if (dlg.kind === 'place' || dlg.kind === 'notpart') dlg.eqIds.forEach((e) => ticks(k).delete(e));
    if (dlg.kind === 'cgMake') STATE.multi[k] = [];
    said(k, r);
    return undefined;
  }

  /* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
     Actions
     ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const on = U.on;
  on('st:accept', (el) => { const k = dget(el, 'plant'); said(k, vcall('acceptStructure', [k, { rowIds: [dget(el, 'row')] }], null)); });
  on('st:accept-up', (el) => { const k = dget(el, 'plant'); said(k, vcall('acceptStructure', [k, { upId: dget(el, 'up') }], null)); });
  on('st:accept-cgs', (el) => {
    const k = dget(el, 'plant'); const sp = passOf(k, 'cgs'); const g = sp ? sp.groups.find((x) => x.key === 'cgs') : null;
    const ids = g ? g.rows.filter((r) => r.state === 'proposed').map((r) => r.rowId) : [];
    said(k, ids.length ? vcall('acceptStructure', [k, { rowIds: ids }], null) : { ok: false, error: 'Nothing left to accept here.' });
  });
  on('st:accept-all', (el) => { const k = dget(el, 'plant'); said(k, vcall('acceptStructure', [k, { all: true }], null)); });
  on('st:reject', (el) => openMd({ kind: 'reject', plant: dget(el, 'plant'), rowId: dget(el, 'row') }));
  on('st:type', (el) => {
    const k = dget(el, 'plant'); const upId = dget(el, 'up'); const u = upOf(k, upId);
    if (!u) return undefined;
    if (vcall('structureDone', [k], false) && (structOf(k) || {}).confirmedAt) { U.toast('The structure is confirmed. Changing a unit process\'s type re-proposes its bindings, which this study doesn\'t do.'); return false; }
    return openMd({ kind: 'type', plant: k, upId, typeId: u.typeId, current: u.typeId });
  });
  on('st:place', (el) => openMd({ kind: 'place', plant: dget(el, 'plant'), eqIds: [dget(el, 'eq')], upIds: new Set() }));
  function notPartNow(k, ids) {
    if (!ids.length) { U.toast('Choose the equipment first.'); return false; }
    if (isLive(k)) return openMd({ kind: 'notpart', plant: k, eqIds: ids });
    const r = vcall('notPart', [k, ids, {}], null);
    if (r && r.ok) ids.forEach((e) => ticks(k).delete(e));
    said(k, r); return undefined;
  }
  on('st:notpart', (el) => notPartNow(dget(el, 'plant'), [dget(el, 'eq')]));
  on('st:tick', (el) => {
    const k = dget(el, 'plant'); const id = dget(el, 'eq'); const s = ticks(k);
    const want = typeof el.checked === 'boolean' ? el.checked : !s.has(id);
    if (want) s.add(id); else s.delete(id);
  });
  on('st:tick-all', (el) => { const k = dget(el, 'plant'); const sp = passOf(k, 'unclassified'); const g = sp ? sp.groups.find((x) => x.key === 'unclassified') : null; if (g) g.rows.forEach((r) => ticks(k).add(r.eqIds[0])); });
  on('st:tick-none', (el) => { ticks(dget(el, 'plant')).clear(); });
  on('st:bulk-place', (el) => { const k = dget(el, 'plant'); const ids = [...ticks(k)]; if (!ids.length) { U.toast('Tick the equipment to place first.'); return false; } return openMd({ kind: 'place', plant: k, eqIds: ids, upIds: new Set() }); });
  on('st:bulk-notpart', (el) => { const k = dget(el, 'plant'); return notPartNow(k, [...ticks(k)]); });
  on('st:rerun', (el) => { const k = dget(el, 'plant'); const r = vcall('rerunIdentification', [k], null); U.toast(r && r.ok !== false ? r.text : (r && r.error) || 'Identification could not run.'); });
  on('st:undo', (el) => { undoAction(dget(el, 'plant'), dget(el, 'token')); });
  on('st:stage', (el) => {
    const k = dget(el, 'plant'); const view = dget(el, 'view'); const cur = (STATE.view[k] && STATE.view[k].q) || {};
    U.go(structHref(k, view, { select: cur.select, show: cur.show, stage: el.value || null })); return false;
  });
  on('st:node', (el, ev) => {
    const k = dget(el, 'plant'); const id = dget(el, 'id'); const kind = dget(el, 'kind');
    const vw = STATE.view[k] || {}; const cur = vw.sel || null; const q = vw.q || {};
    const mod = !!(ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey));
    if (mod && cur && cur.kind === 'up' && kind === 'eq') {
      const u = upOf(k, cur.id); if (!u) return false;
      const member = u.participants.some((x) => x.eqId === id);
      togglePending(k, member ? 'remove' : 'add', cur.id, id);
      return undefined;
    }
    if (mod && cur && cur.kind === 'eq' && kind === 'eq' && id !== cur.id) {
      const n = nodeOf(k, id); const m = multi(k);
      if (!n || !CG_CODES.includes(n.code)) { U.toast(`${n ? n.tag : 'That'} is not a blower or a pump: only those run together under one setpoint.`); return false; }
      const i = m.indexOf(id); if (i >= 0) m.splice(i, 1); else m.push(id);
      return undefined;
    }
    const same = cur && cur.kind === kind && cur.id === id;
    U.go(structHref(k, 'drawing', { select: same ? null : `${kind}:${id}`, stage: q.stage, show: q.show }));
    return false;
  });
  on('st:zoom', (el) => {
    const k = dget(el, 'plant'); const z = dget(el, 'z'); const dr = vcall('drawing', [k], null); if (!dr) return false;
    if (z === 'fit') { STATE.zoom[k] = 'fit'; return undefined; }
    const cur = zoomOf(k, dr); let i = ZOOMS.indexOf(cur === 'fit' ? (dr.zoom || 0.25) : cur); if (i < 0) i = ZOOMS.indexOf(0.25);
    STATE.zoom[k] = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + (z === 'in' ? 1 : -1)))];
    return undefined;
  });
  on('st:remove', (el) => { togglePending(dget(el, 'plant'), 'remove', dget(el, 'up'), dget(el, 'eq')); });
  on('st:putback', (el) => { togglePending(dget(el, 'plant'), 'add', dget(el, 'up'), dget(el, 'eq')); });
  on('st:unpend', (el) => { const k = dget(el, 'plant'); const pd = pend(k); pd.ops = pd.ops.filter((o) => !(o.upId === dget(el, 'up') && o.eqId === dget(el, 'eq'))); });
  on('st:pend-cancel', (el) => { const k = dget(el, 'plant'); STATE.pend[k] = { ops: [], note: '' }; });
  on('st:pend-save', (el) => {
    const k = dget(el, 'plant'); const pd = pend(k); if (!pd.ops.length) return false;
    const r = vcall('editMembers', [k, pd.ops.slice(), { note: String(pd.note || '').trim() }], null);
    if (r && r.ok) STATE.pend[k] = { ops: [], note: '' };
    said(k, r); return undefined;
  });
  on('st:add-eq', (el) => openMd({ kind: 'addEq', plant: dget(el, 'plant'), upId: dget(el, 'up'), eqIds: new Set() }));
  on('st:cg-make', (el) => { const k = dget(el, 'plant'); const pre = String(dget(el, 'eqs') || '').split(',').filter(Boolean); return openMd({ kind: 'cgMake', plant: k, eqIds: new Set(pre), name: '' }); });
  on('st:cg-add', (el) => openMd({ kind: 'cgAdd', plant: dget(el, 'plant'), cgId: dget(el, 'cg'), eqIds: new Set() }));
  on('st:cg-remove', (el) => openMd({ kind: 'cgRemove', plant: dget(el, 'plant'), cgId: dget(el, 'cg'), eqId: dget(el, 'eq') }));
  on('st:multi-clear', (el) => { STATE.multi[dget(el, 'plant')] = []; });
  /* typing: kept in memory; only the save button follows (no re-render, so the caret stays put) */
  on('st:note', (el) => {
    const scope = dget(el, 'scope'); const v = el.value == null ? '' : String(el.value);
    if (scope === 'dlg') { if (STATE.dlg) { STATE.dlg.note = v; STATE.dlg.error = ''; paintMd(el); } return false; }
    const k = dget(el, 'plant'); pend(k).note = v;
    const blocked = isLive(k) && !v.trim();
    const root = el && el.closest ? (el.closest('.st-pending') || el.closest('.st-panel-pend')) : null;
    if (typeof document !== 'undefined' && document.querySelectorAll) {
      try { document.querySelectorAll('[data-act="st:pend-save"]').forEach((b) => { b.disabled = blocked; if (blocked) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); }); } catch (e) { /* the save button refuses anyway */ }
    }
    if (root && root.querySelectorAll) root.querySelectorAll('textarea[name="st-note"]').forEach((t) => { if (t !== el) t.value = v; });
    return false;
  });
  on('st:dlg-up', (el) => {
    const dlg = STATE.dlg; if (!dlg || dlg.kind !== 'place') return false;
    const id = dget(el, 'up'); const want = typeof el.checked === 'boolean' ? el.checked : !dlg.upIds.has(id);
    if (want) dlg.upIds.add(id); else dlg.upIds.delete(id);
    dlg.error = ''; syncTwins(el, 'up', id, want); paintMd(el); return false;
  });
  on('st:dlg-eq', (el) => {
    const dlg = STATE.dlg; if (!dlg || !dlg.eqIds || typeof dlg.eqIds.add !== 'function') return false;
    const id = dget(el, 'eq'); const want = typeof el.checked === 'boolean' ? el.checked : !dlg.eqIds.has(id);
    if (want) dlg.eqIds.add(id); else dlg.eqIds.delete(id);
    dlg.error = ''; syncTwins(el, 'eq', id, want); paintMd(el); return false;
  });
  on('st:dlg-type', (el) => { const dlg = STATE.dlg; if (!dlg || dlg.kind !== 'type') return false; dlg.typeId = dget(el, 'type') || el.value; dlg.error = ''; paintMd(el); return false; });
  on('st:dlg-name', (el) => { const dlg = STATE.dlg; if (dlg) dlg.name = el.value == null ? '' : String(el.value); return false; });
  on('st:dlg-save', () => mdSave());

  /* Enter or Space on a node of the drawing works like a click (with the same modifier keys) */
  if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const t = ev.target && ev.target.closest ? ev.target.closest('.st-n') : null; if (!t) return;
      ev.preventDefault();
      try { t.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: ev.shiftKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey })); } catch (e) { /* older browsers: the list view does the same */ }
    });
  }
  /* a highlighted row (?select= or ?f=) comes into view once per address */
  if (typeof U.afterRender === 'function') {
    U.afterRender((main, path) => {
      if (!main || !main.querySelector || !/^p\/[^/]+\/(structure|review\/structure|cg\/)/.test(String(path || ''))) return;
      const where = String(W.location ? W.location.hash : '');
      if (STATE.scrolled === where) return; STATE.scrolled = where;
      const t = main.querySelector('.is-target');
      if (t && t.scrollIntoView) { try { t.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ } }
      const fr = main.querySelector('.st-frame'); const s = fr ? fr.querySelector('.st-n.is-sel') : null;
      if (fr && s && s.getBBox) { try { const b = s.getBBox(); const svg = fr.querySelector('svg'); const vb = svg.viewBox.baseVal; const k = svg.clientWidth / vb.width; fr.scrollLeft = Math.max(0, (b.x - vb.x) * k - fr.clientWidth / 2); } catch (e) { /* ignore */ } }
    });
  }

  /* ── routes ───────────────────────────────────────────────────────────────────────────────────────────── */
  U.route('p/:plant/structure/:view?', (params) => structurePage(params));
  U.route('p/:plant/review/structure', passPage);
  U.route('p/:plant/review', reviewPage);
  U.route('p/:plant/cg/:id', cgPage);
  U.route('p/:plant/equipment', (params) => structurePage(params, 'list'));
  U.route('p/:plant/scada', passPage);
  if (typeof U.addCss === 'function') U.addCss('assets/structure7.css?v=1');

  W.V7STRUCT = {
    participantsCard, participatesCard, participatesChips, subjectChip, stageCrumb, passTabs,
    pages: { structure: structurePage, pass: passPage, cg: cgPage, review: reviewPage },
    /* for tests */
    _state: () => STATE,
    _md: () => STATE.dlg,
    _mdHtml: () => (STATE.dlg ? { title: mdTitle(STATE.dlg), body: mdBody(STATE.dlg), foot: mdFoot(STATE.dlg) } : null),
    _reset: () => { STATE.tick = {}; STATE.pend = {}; STATE.multi = {}; STATE.zoom = {}; STATE.view = {}; STATE.dlg = null; STATE.last = null; STATE.scrolled = ''; },
  };
}());
