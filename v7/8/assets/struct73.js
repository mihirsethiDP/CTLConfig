/* v7/3 · struct73.js — the plant's structure on screen (card D1): stages, unit processes with the equipment that takes part in
   them, control groups (duty/standby sets), and equipment not placed yet. A new plant's structure is proposed from the Visualization
   and confirmed once. The library gains unit-process types and control-group types (card D7: a control group's type houses the
   changeover work, one task for the set).
   Routes: #/p/:plant/structure · #/library-structure. Exposes window.V7STRUCT73 {chips, filedOptions, libraryCard, homeLine}.
   ACTIONS: st:confirm st:place */
(function () {
  'use strict';
  const W = window; const UI = W.V7UI; if (!UI) return;
  const V = () => W.V7; const { esc, card, btn, chip, note, empty, plural } = UI;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = encodeURIComponent;
  const S = (key) => (V() && V().structure ? V().structure(key) : { ups: [], cgs: [], unplaced: [] });
  const PS = (key) => { const s = V() && V().S; return s && s.plants ? s.plants[key] : null; };
  const eqHref = (key, id) => `#/p/${enc(key)}/eq/${enc(id)}`;
  const eqOf = (key, id) => { try { return V().eq(key, id); } catch (e) { return null; } };
  const tagOf = (key, id) => { const e = eqOf(key, id); return e ? e.tag : id; };
  const ga = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null);

  /* a new plant's proposal is confirmed once; hand placements are kept beside it */
  const confirmed = (key) => { const st = S(key); const p = PS(key); return st.state === 'confirmed' || !!(p && p.structureOk); };
  const placedOf = (key) => { const p = PS(key); return (p && p.placed) || {}; };
  const unplaced = (key) => arr(S(key).unplaced).filter((id) => placedOf(key)[id] == null);
  function membersOf(key, u) {
    const extra = Object.entries(placedOf(key)).filter(([, up]) => up === u.id).map(([eqId]) => ({ eqId, tag: tagOf(key, eqId), role: 'Placed by hand' }));
    return arr(u.members).concat(extra);
  }
  function upsOfEq(key, eqId) {
    const st = S(key); const own = st.ups.find((u) => u.id === eqId); if (own) return [own];
    const hand = placedOf(key)[eqId];
    return st.ups.filter((u) => arr(u.members).some((m) => m.eqId === eqId) || u.id === hand);
  }
  /* where condition-based work raised by this equipment's reading can be filed */
  function filedOptions(key, eqId) {
    return [{ id: '', label: 'the plant' }].concat(upsOfEq(key, eqId).map((u) => ({ id: u.id, label: `${u.tag} (${u.typeName})` })));
  }
  /* chips for an equipment page: what it is in the structure */
  function chips(key, eqId) {
    const st = S(key); const out = []; const own = st.ups.find((u) => u.id === eqId);
    const me = eqOf(key, eqId); const off = me && me.offer;
    if (own) out.push(off && off.library === 'equipment' ? chip(`${own.typeName}, on its own`, { tone: 'muted', href: `#/p/${enc(key)}/structure`, title: `${own.why}. ${off.reason}, so it follows the equipment library.` }) : chip(`Unit process · ${own.typeName}`, { tone: 'info', href: `#/p/${enc(key)}/structure`, title: `${own.stageLabel}. ${own.why}${off ? `. ${off.reason}, so it follows the unit-process library.` : ''}` }));
    else { const ups = upsOfEq(key, eqId); if (ups.length > 1) out.push(chip(`Takes part in ${ups.map((u) => u.tag).join(', ')}`, { tone: 'muted', href: `#/p/${enc(key)}/structure`, title: 'The unit processes this equipment serves' })); else if (arr(st.unplaced).includes(eqId)) out.push(chip('Not placed in a unit process yet', { tone: 'warn', href: `#/p/${enc(key)}/structure` })); }
    return out;
  }
  /* v7/4: where a piece of equipment sits, for its breadcrumb and its one line under the title */
  function place(key, eqId) { const st = S(key); const own = st.ups.find((u) => u.id === eqId) || null; const ups = own ? [] : upsOfEq(key, eqId); const cg = st.cgs.find((c) => c.memberIds.includes(eqId)) || null; return { own, ups, cg, cgWith: cg ? cg.memberIds.filter((x) => x !== eqId).map((x) => tagOf(key, x)) : [] }; }
  /* one line for the plant's Home: the structure and whether it is confirmed */
  function homeLine(key) {
    const st = S(key); if (!st.ups.length) return '';
    const left = unplaced(key).length; const ok = confirmed(key);
    return card({ title: 'Structure', sub: `${plural(st.ups.length, 'unit process', 'unit processes')} · ${plural(st.cgs.length, 'control group')}${left ? ` · ${left} not placed yet` : ''}`, body: ok ? '<p class="muted">Confirmed. Work that belongs to a treatment step is filed on its unit process.</p>' : '<p>Proposed from the Visualization. Look it over and confirm it.</p>', actions: [btn(ok ? 'Open the structure' : 'Review the structure', { href: `#/p/${enc(key)}/structure`, kind: ok ? 'secondary' : 'primary', small: true })], tone: ok ? null : 'warn' });
  }

  function upCard(key, u, dup) {
    const ms = membersOf(key, u); const tasks = (() => { try { return V().tasks(key, { eqId: u.id }).length; } catch (e) { return 0; } })();
    const mem = ms.length ? `<ul class="st-mem">${ms.map((m) => `<li><a class="mono" href="${esc(eqHref(key, m.eqId))}">${esc(m.tag)}</a><span class="muted">${esc(m.role || '')}</span></li>`).join('')}</ul>` : '<p class="muted small">No other equipment takes part in it.</p>';
    return `<article class="st-up"><header><a class="st-up-t" href="${esc(eqHref(key, u.id))}"><span class="mono">${esc(u.tag)}</span> ${esc(u.name || '')}</a><span class="st-up-k">${esc(u.typeName)}${dup ? ` · ${dup.i} of ${dup.n}` : ''}</span></header><p class="st-why">${esc(u.why || '')}</p>${mem}<footer class="muted small"><span>${plural(tasks, 'task')} filed here</span><span class="st-up-a">${btn('See it in the Visualization', { act: 'st:viz', data: { tag: u.tag }, kind: 'ghost', small: true })}${btn('Edit', { act: 'st:up-edit', data: { plant: key, id: u.id }, small: true, title: 'Change its type, move its equipment to another unit process, add equipment, or remove it' })}</span></footer></article>`;
  }
  function structurePage(params, bare) {
    const key = params.plant; const P = W.V7PLANT;
    /* v7/5: while a plant is set up, the structure is part of the one screen for what was read */
    if (!bare && !isLive(key) && PS(key) && P && typeof P.checkPage === 'function') return P.checkPage(params); const st = S(key); const ok = confirmed(key); const left = unplaced(key);
    const stages = arr(W.V7_STAGES).map((sg) => ({ sg, ups: st.ups.filter((u) => (u.stage || null) === sg.key) })).filter((x) => x.ups.length);
    const lead = `<p class="lead">How the equipment is grouped into ${UI.term ? UI.term('unit processes') : 'unit processes'} and ${UI.term ? UI.term('control groups') : 'control groups'}, as read from the Visualization.</p>`;
    const ban = !st.ups.length ? '' : ok ? note(`Structure confirmed${left.length ? `, with ${plural(left.length, 'piece')} of equipment still to place` : ''}.`, 'ok')
      : `<div class="banner tone-warn"><div class="banner-t">Proposed from the Visualization: <b>${plural(st.ups.length, 'unit process', 'unit processes')}</b>, <b>${plural(st.cgs.length, 'control group')}</b>${left.length ? `, and ${plural(left.length, 'piece')} of equipment no rule placed` : ''}. Confirm it to carry on; you can still place equipment afterwards.</div><div class="banner-a">${btn('Confirm the structure', { act: 'st:confirm', data: { plant: key }, kind: 'primary' })}</div></div>`;
    const seen = {}; const tot = {}; st.ups.forEach((u) => { tot[u.typeName] = (tot[u.typeName] || 0) + 1; });
    const dupOf = (u) => (tot[u.typeName] > 1 ? { i: (seen[u.typeName] = (seen[u.typeName] || 0) + 1), n: tot[u.typeName] } : null);
    const twice = Object.keys(tot).filter((k) => tot[k] > 1);
    const body = [lead, ban, `<div class="st-tools"><span class="muted small">Open Edit on a unit process to change its type, move its equipment to another unit process, or remove it.</span>${btn('Add a unit process', { act: 'st:up-new', data: { plant: key } })}</div>`];
    if (twice.length) body.push(note(`${twice.length === 1 ? 'One type appears' : `${twice.length} types appear`} more than once: ${twice.map((k) => `${k} (${tot[k]})`).join(', ')}. Each is its own tank or reactor, so each stays its own unit process, numbered and named by its tag.`, 'quiet'));
    stages.forEach((x) => body.push(`<section class="st-stage"><h3 class="st-stage-h">${esc(x.sg.label)} <span class="muted">· ${x.ups.length}</span></h3><div class="st-ups">${x.ups.map((u) => upCard(key, u, dupOf(u))).join('')}</div></section>`));
    if (!st.cgs.length && st.ups.length) body.push(card({ title: 'Control groups', sub: 'No duty/standby sets yet.', actions: [btn('Add a control group', { act: 'st:cg-new', data: { plant: key }, small: true })] }));
    if (st.cgs.length) body.push(card({ actions: [btn('Add a control group', { act: 'st:cg-new', data: { plant: key }, small: true })], title: 'Control groups', sub: 'A duty/standby set runs as one, so its changeover is one task for the set, not one per piece of equipment.', body: `<ul class="st-cgs">${st.cgs.map((c) => `<li><b>${esc(c.name)}</b><span>${c.memberIds.map((id) => `<a class="mono" href="${esc(eqHref(key, id))}">${esc(tagOf(key, id))}</a>`).join(' ')}</span>${arr(c.feeds).length ? `<span class="muted small">serves ${esc(c.feeds.map((id) => tagOf(key, id)).join(', '))}</span>` : ''}${btn('Edit', { act: 'st:cg-edit', data: { plant: key, id: c.id }, small: true, kind: 'ghost' })}</li>`).join('')}</ul>` }));
    if (left.length) {
      const opts = st.ups.map((u) => `<option value="${esc(u.id)}">${esc(u.tag)} · ${esc(u.typeName)}</option>`).join('');
      body.push(card({ title: `${plural(left.length, 'piece')} of equipment not placed yet`, sub: 'No rule could tell which unit process these serve. Place each one, or leave it on the plant.', tone: 'warn', body: `<ul class="st-left">${left.map((id) => { const e = eqOf(key, id) || {}; return `<li><span><a class="mono" href="${esc(eqHref(key, id))}">${esc(e.tag || id)}</a> ${esc(e.name || '')} <span class="muted">· ${esc(e.typeName || '')}</span></span><select data-act="st:place" data-plant="${esc(key)}" data-eq="${esc(id)}" aria-label="Place ${esc(e.tag || id)}"><option value="">Place in…</option>${opts}<option value="__plant">Leave on the plant</option></select></li>`; }).join('')}</ul>` }));
    }
    if (!st.ups.length) body.push(empty('No structure yet: the Visualization has no basins or reactors to build it from.'));
    const html = body.join('');
    if (bare) return html;
    if (P && typeof P.frame === 'function') return P.frame(key, 'structure', html);
    return UI.page({ title: 'Structure', body: html });
  }

  /* ── the two libraries: which one a node gets, and what a type page says about it ── */
  const N = () => W.V7NODES || null;
  const libHref = (code) => '#/library/' + enc(code);
  const mono = (c) => '<span class="mono st-code">' + esc(c) + '</span>';
  const RULE = 'A tank or reactor that is the centre of a treatment step can get either library. If other equipment takes part in it (pumps, blowers, dosing, valves), it gets the <b>unit-process</b> library for that step. If it stands on its own, it gets the <b>equipment</b> library for that tank or reactor. A pump, a blower or a valve always gets the equipment library.';
  function libraryCard() {
    const n = arr(W.V7_UP_TYPES).length;
    return card({ title: 'Which library a node gets', sub: n + ' unit-process types sit beside the equipment types. A tank with equipment taking part in it gets the unit-process library; on its own it gets the equipment library.', actions: [btn('How it is decided', { href: '#/library-structure', small: true })], tone: 'quiet' });
  }
  function axesTable(axes) {
    const ax = arr(axes); if (!ax.length) return '';
    return UI.table({ cols: [{ label: 'Sub-type', key: 'a' }, { label: 'Needed', key: 'r', cls: 'nowrap' }, { label: 'Values, and the code for each', key: 'v' }],
      rows: ax.map((a) => ({ a: '<b>' + esc(a.label) + '</b>' + (a.note ? '<div class="muted small">' + esc(a.note) + '</div>' : ''), r: a.required ? 'Yes' : 'No', v: a.values.length ? '<div class="st-vals">' + a.values.map((v) => '<span class="st-val">' + esc(v.name) + ' ' + mono(v.code) + '</span>').join('') + '</div>' + (a.many ? '<div class="muted small">A node can hold several: join them with a hyphen.</div>' : '') : '<span class="muted">Not defined yet</span>' })) });
  }
  /* the Details tab of a library type: which library it is, what draws it, its sub-types */
  function typeCard(code) {
    const n = N(); const ab = n ? n.about(code) : null; if (!ab) return '';
    if (ab.library === 'process') {
      const p = ab.p; const drawn = p.detect.map(mono).join(' ');
      const words = p.labels.length ? 'or a tank whose name contains ' + p.labels.map((w) => '\u201c' + esc(w) + '\u201d').join(' or ') : '';
      const rows = [
        ['Library', 'Unit processes \u00b7 ' + ab.group + (ab.subgroup ? ' \u00b7 ' + ab.subgroup : '')],
        ['A node gets it when', { html: 'It is drawn as this step <b>and other equipment takes part in it</b>: pumps, blowers, dosing, valves.' }],
        ['On its own it gets', { html: '<a href="' + esc(libHref(ab.node.code)) + '">' + esc(ab.node.name) + '</a> <span class="muted">from the equipment library</span>' }],
        ['Detected by', { html: drawn + (words ? ' <span class="muted">' + words + '</span>' : '') }],
        ['Stored as', { html: mono(p.stored) }],
        ['Holds water', p.tank ? 'Yes: it stores a volume, an area and a height' : 'No'],
      ];
      const ex = p.axes.some((a) => a.values.length) ? '<p class="muted small mt">A full code is the step, then one part per sub-type, joined with an underscore: ' + mono(p.stored === 'sabre' ? 'BIG_SABRE' : p.detect[0] + '_' + p.axes.filter((a) => a.values.length).map((a) => a.values[0].code).join('_')) + '.</p>' : '';
      return card({ title: 'Where this type comes from', sub: 'A unit process is one treatment step. It carries what its tank or reactor carries, plus the routine work of the step.', body: UI.kv(rows) + axesTable(p.axes) + ex, cls: 'st-about' });
    }
    const t = ab.t; const rows = [['Library', 'Equipment' + (ab.added ? ' \u00b7 added with the unit-process types' : '')]];
    if (ab.processes.length) rows.push(['Also the centre of', { html: ab.processes.map((p) => '<a href="' + esc(libHref(p.key)) + '">' + esc(p.name) + '</a>').join(', ') + ' <span class="muted">\u00b7 a node gets that library instead when other equipment takes part in it</span>' }]);
    if (ab.copiedFrom) rows.push(['Starts from', ab.copiedFrom]);
    if (t) { rows.push(['Kind of equipment', { html: esc(t.name) + ' ' + mono(t.code) }]); if (ab.sets.length) rows.push(['This type means', ab.sets.map((x) => x.axis + ': ' + x.values.join(', ')).join(' \u00b7 ')]); }
    if (rows.length < 2) return '';
    const ex = t && t.example ? '<p class="muted small mt">A full code is the kind of equipment, then one part per sub-type: ' + mono(t.example[0]) + ' is ' + esc(t.example[1]) + '. A code like that is read to the library type it stands for.</p>' : '';
    return card({ title: 'Where this type comes from', body: UI.kv(rows) + (t ? axesTable(t.axes) + ex : ''), cls: 'st-about' });
  }
  /* rows for an equipment page's facts: the library it was offered, and why */
  function offerFacts(e) {
    const out = []; if (!e) return out;
    if (e.offer) out.push(['Library', { html: (e.offer.library === 'process' ? 'Unit processes' : 'Equipment') + ' <span class="muted">\u00b7 ' + esc(e.offer.why) + '. ' + esc(e.offer.reason) + '.</span>' }]);
    if (e.subtype && arr(e.subtype.words).length) out.push(['Sub-type', e.subtype.words.map((w) => w.axis + ': ' + w.values.join(', ')).join(' \u00b7 ')]);
    return out;
  }
  function libStructurePage() {
    const n = N(); const types = arr(W.V7_UP_TYPES); const used = {}; Object.entries(W.V7_STRUCTURE || {}).forEach(([k, st]) => arr(st.ups).forEach((u) => { (used[u.typeId] = used[u.typeId] || []).push(k); }));
    const pname = (k) => { try { return V().plant(k).name; } catch (e) { return k; } };
    const tname = (c) => { const x = (W.CATALOGUE_BY_CODE || {})[c]; return x ? x.type : c; };
    const byStage = arr(W.V7_STAGES).map((sg) => ({ sg, ts: types.filter((t) => (t.stage || null) === sg.key) })).filter((x) => x.ts.length);
    const upHtml = byStage.map((x) => '<h3 class="st-stage-h">' + esc(x.sg.label) + ' <span class="muted">\u00b7 ' + x.ts.length + '</span></h3>' + UI.table({ cols: [{ label: 'Unit-process type', key: 'n' }, { label: 'Detected by', key: 'c' }, { label: 'On its own it gets', key: 'e' }, { label: 'Used at', key: 'u' }],
      rows: x.ts.map((t) => { const us = [...new Set(used[t.id] || [])]; const p = n ? n.upByKey[t.id] : null; return { n: '<a href="' + esc(libHref(t.id)) + '"><b>' + esc(t.name) + '</b></a>' + (t.subgroup ? '<div class="muted small">' + esc(t.subgroup) + '</div>' : ''), c: mono(t.code) + (p && p.labels.length ? '<div class="muted small">or a tank named \u201c' + esc(p.labels[0]) + '\u201d</div>' : ''), e: '<a href="' + esc(libHref(t.node)) + '">' + esc(tname(t.node)) + '</a>', u: us.length ? esc(us.map(pname).join(', ')) : '<span class="muted">Not used yet</span>' }; }) })).join('');
    const eqHtml = n ? UI.table({ cols: [{ label: 'Kind of equipment', key: 'n' }, { label: 'Code', key: 'c', cls: 'nowrap' }, { label: 'Sub-types', key: 'a' }, { label: 'Library types it reads to', key: 'l' }],
      rows: n.EQ.map((t) => { const libs = [...new Set(t.existing.concat([t.lib({})]))].filter((c) => (W.CATALOGUE_BY_CODE || {})[c]); return { n: '<b>' + esc(t.name) + '</b><div class="muted small">' + esc(t.group) + '</div>', c: mono(t.code), a: t.axes.length ? esc(t.axes.map((a) => a.label).join(', ')) : '<span class="muted">None</span>', l: libs.map((c) => '<a href="' + esc(libHref(c)) + '">' + esc(tname(c)) + '</a>').join(', ') }; }) }) : '';
    const kinds = {}; Object.entries(W.V7_STRUCTURE || {}).forEach(([k, st]) => arr(st.cgs).forEach((c) => { const kk = c.kind || 'set'; (kinds[kk] = kinds[kk] || { n: 0, plants: new Set() }); kinds[kk].n++; kinds[kk].plants.add(k); }));
    const CG = { blower: ['Blower set', 'Routine work - Blower duty / standby changeover'], pump: ['Pump set', 'Duty / standby changeover'] };
    const cgRows = Object.keys(kinds).map((k) => ({ n: '<b>' + esc((CG[k] || [k.charAt(0).toUpperCase() + k.slice(1) + ' set'])[0]) + '</b>', w: esc((CG[k] || [null, 'Duty / standby changeover'])[1]), u: plural(kinds[k].n, 'group') + ' at ' + esc([...kinds[k].plants].map(pname).join(', ')) }));
    const pic = '<div class="st-rule"><div class="st-rule-c"><span class="st-rule-k">A treated water tank, with pumps and dosing taking part in it</span><span class="st-rule-a">gets</span><a class="st-rule-l" href="' + esc(libHref('treated_water')) + '">Treated water <small>unit-process library</small></a></div><div class="st-rule-c"><span class="st-rule-k">A treated water tank on its own</span><span class="st-rule-a">gets</span><a class="st-rule-l" href="' + esc(libHref('TW-TANK')) + '">Treated water tank <small>equipment library</small></a></div><div class="st-rule-c"><span class="st-rule-k">A pump, a blower or a valve</span><span class="st-rule-a">always gets</span><a class="st-rule-l" href="#/library">Its own type <small>equipment library</small></a></div></div>';
    return UI.page({
      crumbs: [{ label: 'Library', href: '#/library' }, { label: 'Which library a node gets' }], title: 'Which library a node gets',
      sub: 'Two libraries: equipment, and unit processes. The Visualization decides which one each node gets; nothing is drawn twice.',
      body: card({ title: 'The rule', body: '<p>' + RULE + '</p>' + pic })
        + card({ title: 'Unit-process types \u00b7 ' + types.length, sub: 'One treatment step each. Open one for its readings, alerts and tasks, and for the codes and sub-types that draw it.', body: upHtml, actions: [btn('Open the unit-process library', { href: '#/library?lib=process', small: true })] })
        + (eqHtml ? card({ title: 'Kinds of equipment \u00b7 ' + n.EQ.length, sub: 'A pump, a valve or a tank is one kind with sub-types. Each code, old or new, is read to a type in the equipment library.', body: eqHtml, actions: [btn('Open the equipment library', { href: '#/library', small: true })] }) : '')
        + card({ title: 'Control-group types', sub: 'A duty/standby set that runs as one. Its changeover work is housed here: one task for the set at each plant.', body: cgRows.length ? UI.table({ cols: [{ label: 'Control-group type', key: 'n' }, { label: 'Work it houses', key: 'w' }, { label: 'Used at', key: 'u' }], rows: cgRows }) : empty('No control groups yet.') }),
      cls: 'pg-libstruct',
    });
  }

  /* v7/4: changing the structure by hand. Every change goes through one small dialog; a live plant asks why. */
  const isLive = (key) => { const p = PS(key); return !!(p && p.state === 'live'); };
  const whyField = (key) => (isLive(key) ? '<label class="st-f">Why<span class="muted small">The plant is live, so a change to its structure needs a reason.</span><textarea id="stWhy" rows="2"></textarea></label>' : '');
  const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  function typeOpts(cur) {
    const groups = []; arr(N() && N().UP).forEach((p) => { let g = groups.find((x) => x.label === p.groupLabel); if (!g) groups.push(g = { label: p.groupLabel, ps: [] }); g.ps.push(p); });
    return '<option value="">Choose a type…</option>' + groups.map((g) => `<optgroup label="${esc(g.label)}">${g.ps.map((p) => `<option value="${esc(p.stored)}"${p.stored === cur ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
  }
  const eqLabel = (e) => `${e.tag} · ${e.name || ''} (${e.typeName || ''})`;
  function openUp(key, id) {
    const st = S(key); const u = st.ups.find((x) => x.id === id); if (!u) { UI.toast('That unit process is no longer there.'); return; }
    const ms = membersOf(key, u); const others = st.ups.filter((x) => x.id !== id); const left = unplaced(key);
    const here = new Set(ms.map((m) => m.eqId).concat([id])); const centres = new Set(st.ups.map((x) => x.id));
    const addable = arr(V().equipment(key)).filter((e) => !here.has(e.id) && !centres.has(e.id)).sort((a, b) => (left.includes(b.id) ? 1 : 0) - (left.includes(a.id) ? 1 : 0));
    const rows = ms.length ? `<ul class="st-ed">${ms.map((m) => `<li><span><b class="mono">${esc(m.tag)}</b> <span class="muted">${esc(m.role || '')}</span></span><select data-st-move="${esc(m.eqId)}" aria-label="Where ${esc(m.tag)} goes"><option value="">Stays here</option>${others.map((o) => `<option value="${esc(o.id)}">Move to ${esc(o.tag)} · ${esc(o.typeName)}</option>`).join('')}<option value="__out">Take out of this unit process</option></select></li>`).join('')}</ul>` : '<p class="muted small">No other equipment takes part in it yet.</p>';
    const body = `<label class="st-f">Type<select id="stType">${typeOpts(u.typeId)}</select></label>`
      + `<div class="st-f">Equipment that takes part in it<span class="muted small">To move a piece to another unit process, choose where it goes.</span>${rows}</div>`
      + `<label class="st-f">Add equipment<span class="muted small">A piece can take part in more than one unit process, like a blower that serves two tanks.</span><select id="stAdd"><option value="">Choose equipment…</option>${addable.map((e) => `<option value="${esc(e.id)}">${esc(eqLabel(e))}${left.includes(e.id) ? ' · not placed yet' : ''}</option>`).join('')}</select></label>` + whyField(key);
    UI.modal({ title: `${u.tag} ${u.name || ''}`, sub: 'Change its type, move the equipment that takes part in it, or add equipment.', body,
      foot: btn('Remove this unit process', { act: 'st:up-remove', data: { plant: key, id }, kind: 'ghost' }) + btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Save', { act: 'st:up-save', data: { plant: key, id }, kind: 'primary' }) });
  }
  function openNewUp(key) {
    const st = S(key); const left = unplaced(key); const centres = new Set(st.ups.map((x) => x.id));
    const eqs = arr(V().equipment(key)).filter((e) => !centres.has(e.id) && !/pump|blower|valve/i.test(e.typeName || '')).sort((a, b) => (left.includes(b.id) ? 1 : 0) - (left.includes(a.id) ? 1 : 0));
    const body = `<label class="st-f">The tank or reactor at its centre<span class="muted small">A unit process is one treatment step, named after the equipment at its centre. A pump, a blower or a valve is never the centre: it takes part in one.</span><select id="stEq"><option value="">Choose equipment…</option>${eqs.map((e) => `<option value="${esc(e.id)}">${esc(eqLabel(e))}${left.includes(e.id) ? ' · not placed yet' : ''}</option>`).join('')}</select></label>`
      + `<label class="st-f">Type<span class="muted small">One of the 53 unit processes in the library. No other type can exist.</span><select id="stType">${typeOpts('')}</select></label>` + whyField(key);
    UI.modal({ title: 'Add a unit process', sub: 'Once it is added, open it to say which equipment takes part in it.', body, foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Add it', { act: 'st:up-add', data: { plant: key }, kind: 'primary' }) });
  }
  function openCg(key, id) {
    const st = S(key); const c = id ? st.cgs.find((x) => x.id === id) : null; if (id && !c) { UI.toast('That control group is no longer there.'); return; }
    const mine = new Set(c ? c.memberIds : []); const taken = new Set(); st.cgs.forEach((x) => { if (!c || x.id !== c.id) x.memberIds.forEach((m) => taken.add(m)); });
    const eqs = arr(V().equipment(key)).filter((e) => !taken.has(e.id)).sort((a, b) => (mine.has(b.id) ? 1 : 0) - (mine.has(a.id) ? 1 : 0) || String(a.typeName).localeCompare(String(b.typeName)));
    const body = `<label class="st-f">Name<input type="text" id="stName" value="${esc(c ? c.name : '')}" placeholder="For example: Feed pumps"></label>`
      + `<div class="st-f">Equipment in the set<span class="muted small">A duty/standby set that runs as one. Its changeover is one task for the set. Equipment already in another control group is not listed.</span><div class="st-checks">${eqs.map((e) => `<label><input type="checkbox" data-st-mem value="${esc(e.id)}"${mine.has(e.id) ? ' checked' : ''}> <b class="mono">${esc(e.tag)}</b> ${esc(e.name || '')} <span class="muted">· ${esc(e.typeName || '')}</span></label>`).join('')}</div></div>` + whyField(key);
    UI.modal({ title: c ? c.name : 'Add a control group', sub: c ? 'Rename it, or change which equipment is in the set.' : 'Choose the equipment that runs as one duty/standby set.', body,
      foot: (c ? btn('Remove this control group', { act: 'st:cg-remove', data: { plant: key, id }, kind: 'ghost' }) : '') + btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(c ? 'Save' : 'Add it', { act: 'st:cg-save', data: { plant: key, id: id || '' }, kind: 'primary' }) });
  }
  const finish = (r, okText) => { if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not work.'); return false; } UI.closeModal(true); UI.toast(r.nothing ? 'Nothing changed.' : okText); UI.render(); return false; };
  UI.on('st:up-new', (el) => { openNewUp(ga(el, 'plant')); return false; });
  UI.on('st:up-edit', (el) => { openUp(ga(el, 'plant'), ga(el, 'id')); return false; });
  UI.on('st:up-add', (el) => finish(V().addUnitProcess(ga(el, 'plant'), { eqId: val('stEq'), typeId: val('stType'), reason: val('stWhy') }), 'Unit process added. Open it to say which equipment takes part in it.'));
  UI.on('st:up-save', (el) => { const moves = Array.from(document.querySelectorAll('[data-st-move]')).map((s) => ({ eqId: s.getAttribute('data-st-move'), to: s.value })); return finish(V().setUnitProcess(ga(el, 'plant'), ga(el, 'id'), { typeId: val('stType'), moves, add: [val('stAdd')], reason: val('stWhy') }), 'Saved.'); });
  UI.on('st:up-remove', (el) => { const key = ga(el, 'plant'); const id = ga(el, 'id'); const why = val('stWhy'); const u = S(key).ups.find((x) => x.id === id); if (!u) return false; if (isLive(key) && !why.trim()) { UI.toast('Say why first: the plant is live.'); return false; }
    UI.confirm({ title: `Remove the unit process ${u.tag}?`, body: `${u.tag} goes back to being equipment. Equipment that took part only in it is listed as not placed, so you can place it again. Nothing is deleted from the plant.`, ok: 'Remove it', kind: 'primary', onOk: () => finish(V().removeUnitProcess(key, id, { reason: why }), 'Unit process removed.') }); return false; });
  UI.on('st:cg-new', (el) => { openCg(ga(el, 'plant'), null); return false; });
  UI.on('st:cg-edit', (el) => { openCg(ga(el, 'plant'), ga(el, 'id')); return false; });
  UI.on('st:cg-save', (el) => finish(V().saveControlGroup(ga(el, 'plant'), ga(el, 'id') || null, { name: val('stName'), memberIds: Array.from(document.querySelectorAll('[data-st-mem]')).filter((c) => c.checked).map((c) => c.value), reason: val('stWhy') }), 'Saved.'));
  UI.on('st:cg-remove', (el) => { const key = ga(el, 'plant'); const id = ga(el, 'id'); const why = val('stWhy'); const c = S(key).cgs.find((x) => x.id === id); if (!c) return false; if (isLive(key) && !why.trim()) { UI.toast('Say why first: the plant is live.'); return false; }
    UI.confirm({ title: `Remove the control group ${c.name}?`, body: 'Its equipment stays where it is. Its changeover stops being one task for the set.', ok: 'Remove it', kind: 'primary', onOk: () => finish(V().removeControlGroup(key, id, { reason: why }), 'Control group removed.') }); return false; });

  UI.on('st:viz', (el) => { const t = ga(el, 'tag'); UI.toast(`In the product this opens the Visualization${t ? ` at ${t}` : ''} beside this page, so the drawing is there while you check the structure. The prototype does not hold the drawing.`); return false; });
  UI.on('st:confirm', (el) => { const key = ga(el, 'plant'); const p = PS(key); if (!p) return false; p.structureOk = V().now(); try { V().log(key, `Structure confirmed: ${plural(S(key).ups.length, 'unit process', 'unit processes')} and ${plural(S(key).cgs.length, 'control group')}, as proposed from the Visualization`, 'config'); } catch (e) { /* ignore */ } UI.toast('Structure confirmed.'); return undefined; });
  UI.on('st:place', (el) => { const key = ga(el, 'plant'); const v = el.value; if (!v) return false; if (isLive(key)) { UI.toast('The plant is live: open Edit on the unit process and add it there, with a reason.'); el.value = ''; return false; } const r = V().placeEquipment(key, ga(el, 'eq'), v === '__plant' ? '' : v); if (!r.ok) { UI.toast(r.error); return false; } return undefined; });

  UI.route('p/:plant/structure', structurePage);
  UI.route('library-structure', libStructurePage);
  W.V7STRUCT73 = { chips, place, body: (key) => structurePage({ plant: key }, true), filedOptions, libraryCard, homeLine, confirmed, unplaced, upsOfEq, typeCard, offerFacts };
}());
