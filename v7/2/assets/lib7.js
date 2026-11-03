/* v7/2 · lib7.js · window.V7LIB — the library: its home and lists, the type pages, the template page with its limit-rule editor,
   Downstream + Publish, pins, conditions, flows and root causes.
   Loads after ui7.js (window.V7UI) and object7.js (window.V7OBJ); reads window.V7 lazily, and every V7 call goes through safe()
   (a failure lands in V7UI._soft and the page still renders).

   ROUTES (registered here and nowhere else)
     #/library                                    home: seven collections with their counts, the drafts not yet published, search
     #/library/plant-types · up-types · eq-types · templates          the lists (templates: ?kind=trigger|task|single, ?owner=)
     #/library/eq-types/:code/:tab? · up-types/:id/:tab?              type pages: V7OBJ.render({mode:'eqType'|'upType'}) with
                                                                     aside = downstreamAside(owner); a read-only page of its own
                                                                     when object7.js has no type mode; ?promote= on a tier override
     #/library/plant-types/:id/:tab?              plant type: Tasks · Types offered · Plants
     #/library/templates/:id[?promote=|?merge=1|?f=]                  template page: limit rules or cadence, settings, use, history;
                                                                     aside: Downstream (before any edit) or Downstream + Publish
     #/library/conditions/:id? · flows/:id? · root-causes/:id?        read-only lists and details, with search
     #/library/:code/:tab?                        older type links: the equipment type page for a known code, else the home
   API (window.V7LIB)
     downstreamAside(owner, query) → html      owner {kind:'eqType', code} | {kind:'upType', id} | {kind:'plantType', id}
     templateAside(id, query) → html           Downstream for one template (the table before an edit, or Downstream + Publish)
     editorHtml(id, {sheet}) → html            the one limit-rule / cadence editor (template page and the [Edit template] sheet)
     editTemplateButton(id, {band, mode}) → html          opens that editor in a sheet (act tpl:sheet)
     pinButton(plant, templateId) → html       [Pin this plant to v{n}] or the pin chip with [Unpin · follows v{cur}] (acts pin:*)
     typeBanner(code) → html                   the banner of a type that is a unit process in the plant graph, with its links
   ACTIONS (data-act; the shell re-renders after each unless it returns false)
     lib:q (live search, data-scope) · lib:q-clear · lib:owner (select)
     tpl:mode · tpl:param · tpl:field (live) · tpl:save · tpl:sheet · tpl:pubkind · tpl:pubfield (live) · tpl:countfrom ·
     tpl:publish · tpl:discard · tpl:lift · tpl:lift-field · tpl:lift-save · tpl:typepub
     pin:open · pin:field (live) · pin:save · pin:unpin
   Words on screen follow the v7/2 word list; every number comes from a core function. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const UI = W.V7UI;
  if (!UI) { if (W.console) console.warn('lib7.js needs ui7.js (window.V7UI) loaded first'); return; }
  const V = () => W.V7 || null;
  const { esc, page, chip, table, card, section, kv, list, empty, note, field, btn, link, plural } = UI;
  const filters = UI.filters;
  const bannerOf = (text, o) => (typeof UI.banner === 'function' ? UI.banner(text, o) : note(text, (o && o.tone) || 'info'));

  /* ── small helpers ─────────────────────────────────────────────────────────────────────────────────────── */
  function soft(e) { try { if (Array.isArray(UI._soft)) { UI._soft.push('lib7: ' + String((e && e.message) || e)); if (UI._soft.length > 200) UI._soft.shift(); } } catch (x) { /* ignore */ } }
  function safe(fn, fb) { try { const v = fn(); return v === undefined || v === null ? fb : v; } catch (e) { soft(e); return fb; } }
  function call(name, args, fb) { const v = V(); if (!v || typeof v[name] !== 'function') return fb; return safe(() => v[name](...(args || [])), fb); }
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = encodeURIComponent;
  const H = (s) => ({ html: String(s == null ? '' : s) });
  const attr = (el, k) => (el && el.getAttribute ? el.getAttribute(k) : null);
  const cap = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  const isNum = (x) => x !== null && x !== '' && x !== undefined && isFinite(+x);
  function qs(o) { const s = Object.keys(o).filter((k) => o[k] != null && o[k] !== '' && o[k] !== 'all').map((k) => `${k}=${enc(o[k])}`).join('&'); return s ? '?' + s : ''; }
  function joinAnd(xs) { const a = arr(xs).filter(Boolean); return a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`; }
  function plantName(key) { return UI.plantName ? UI.plantName(key) : String(key || ''); }
  function plants() { return arr(call('plants', [], [])); }
  function fmtDate(ms) { return ms == null ? '—' : call('fmtDate', [ms], null) || UI.fmtDay(ms); }
  const pct = (f) => Math.round(+f * 10000) / 100;
  const BANDS = ['caution', 'minor', 'major', 'emergency'];
  const BAND = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const KINDS = ['patch', 'minor', 'major', 'forced'];
  const KIND_LABEL = { patch: 'Patch', minor: 'Minor', major: 'Major', forced: 'Forced' };
  const KIND_SUB = {
    patch: 'Wording only: nothing changes at any plant.',
    minor: 'A value, limit rule, persistence, clearing or cadence: plants that follow change at once; overrides show Base moved.',
    major: 'A band added or removed: each plant that follows gets a new draft in its review queue and stays on its version until it accepts.',
    forced: 'The Emergency band or a statutory template: reaches every plant, pinned ones too; overrides on that band are suspended.',
  };
  const UNITS = ['hour', 'day', 'week', 'month', 'year'];
  const WORK_LABEL = { pm: 'Preventive maintenance', routine: 'Routine check', work: 'Routine work', test: 'Hand test', calibration: 'Calibration', condition: 'When a reading calls for it', round: 'Plant round' };
  const workLabel = (w) => WORK_LABEL[w] || (w ? cap(w) : '—');

  try { UI.addCss('assets/lib7.css?v=1'); } catch (e) { /* no DOM */ }

  /* typed values live here, so a re-render never loses them */
  const ST = { q: {}, ed: {}, pub: {}, pin: null, lift: null, typepub: {}, last: { type: null } };
  const edForm = (id) => ST.ed[id] || (ST.ed[id] = { bands: {}, cond: {} });
  const pubForm = (id) => ST.pub[id] || (ST.pub[id] = {});

  /* the one source-chip renderer: {text, tone, sub, small, extra} from V7.chipFor or a core view */
  function chipHtml(c) {
    if (!c) return '';
    if (typeof c === 'string') return chip(c, { tone: 'lib' });
    const main = chip(c.text || '', { tone: c.tone || 'lib' });
    const extra = arr(c.extra).filter((x) => x && x.text).map((x) => chip(x.text, { tone: x.tone || 'lib' })).join(' ');
    return `<span class="lb-chip">${main}${extra ? ' ' + extra : ''}${c.sub ? `<span class="lb-csub">${esc(c.sub)}</span>` : ''}${c.small ? `<small class="lb-csmall">${esc(c.small)}</small>` : ''}</span>`;
  }

  /* ── owners (where the library lists a template) ───────────────────────────────────────────────────────── */
  function ownerHref(o) { if (!o) return '#/library'; return o.kind === 'upType' ? `#/library/up-types/${enc(o.id)}` : o.kind === 'plantType' ? `#/library/plant-types/${enc(o.id)}` : `#/library/eq-types/${enc(o.code)}`; }
  function ownerKey(o) { if (!o) return ''; return o.kind === 'upType' ? `up:${o.id}` : o.kind === 'plantType' ? `plant:${o.id}` : `eq:${o.code}`; }
  function ownerCode(o) { return !o ? null : o.kind === 'eqType' ? o.code : o.id; }
  function ownerList(o) {
    if (o && o.kind === 'upType') return { label: 'Unit-process types', href: '#/library/up-types' };
    if (o && o.kind === 'plantType') return { label: 'Plant types', href: '#/library/plant-types' };
    return { label: 'Equipment types', href: '#/library/eq-types' };
  }
  function ownerView(o) {
    if (!o) return null;
    if (o.kind === 'upType') return call('upTypeView', [o.id], null);
    if (o.kind === 'plantType') return call('plantTypeView', [o.id], null);
    return call('libType', [o.code], null);
  }
  function ownerName(o) { const v = ownerView(o); return (v && (v.typeName || v.name)) || (o && (o.typeName || o.code || o.id)) || ''; }
  function ownerTemplates(o) { return arr(call('templates', [{ owner: ownerKey(o) }], [])); }
  function upName(id) { const u = arr(call('upTypes', [], [])).find((x) => x && x.id === id); return u ? u.name : id; }

  /* ── library tabs (the seven collections) ──────────────────────────────────────────────────────────────── */
  const COLS = [['home', 'Overview', '#/library'], ['plant-types', 'Plant types', '#/library/plant-types'], ['up-types', 'Unit-process types', '#/library/up-types'],
    ['eq-types', 'Equipment types', '#/library/eq-types'], ['templates', 'Templates', '#/library/templates'], ['conditions', 'Conditions', '#/library/conditions'],
    ['flows', 'Flows', '#/library/flows'], ['root-causes', 'Root causes', '#/library/root-causes']];
  const libTabs = () => COLS.map(([id, label, href]) => ({ id, label, href }));
  function libPage(o) {
    return page({
      crumbs: o.crumbs || (o.active === 'home' ? [] : [{ label: 'Library', href: '#/library' }, { label: o.title }]),
      title: o.title, sub: o.sub, chips: o.chips, tabs: libTabs(), active: o.active, body: o.body, banner: o.banner, cls: 'pg-lib' + (o.cls ? ' ' + o.cls : ''),
    });
  }
  function searchBox(scope, placeholder) {
    const val = ST.q[scope] || '';
    return `<div class="lb-tools"><input type="search" id="lbq-${esc(scope)}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" value="${esc(val)}" data-act="lib:q" data-scope="${esc(scope)}" data-live autocomplete="off">`
      + (val ? btn('Clear', { act: 'lib:q-clear', data: { scope }, small: true, kind: 'ghost' }) : '') + '</div>';
  }
  const needle = (scope) => String(ST.q[scope] || '').trim().toLowerCase();
  const hits = (n, ...xs) => !n || xs.some((x) => String(x == null ? '' : x).toLowerCase().includes(n));

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     LIBRARY HOME  #/library
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function counts() {
    const tpls = arr(call('templates', [{}], [])); const fl = arr(call('flows', [], []));
    return {
      plantTypes: arr(call('plantTypes', [], [])).length, upTypes: arr(call('upTypes', [], [])).length, eqTypes: arr(call('libTypes', [], [])).length,
      templates: tpls.length, trig: tpls.filter((t) => t.kind === 'trigger').length, task: tpls.filter((t) => t.kind === 'task').length,
      conditions: arr(call('conditions', [], [])).length, flows: fl.length, diag: fl.filter((f) => f.kind === 'diagnostic').length, action: fl.filter((f) => f.kind !== 'diagnostic').length,
      causes: arr(call('rootCauses', [], [])).length,
    };
  }
  function draftsStrip() {
    const drafts = arr(call('templates', [{}], [])).filter((t) => t && t.draft);
    if (!drafts.length) return '';
    const rows = drafts.map((t) => {
      const dv = call('templateDraft', [t.id], null);
      return { title: `${t.name} · draft v${dv ? dv.nextVersion : t.v + 1}`, href: t.href, sub: dv ? arr(dv.diffs).map((d) => d.text).join('; ') : '', right: t.ownerName };
    });
    return card({ title: 'Drafts', sub: `${plural(drafts.length, 'draft')} not published: no plant sees ${drafts.length === 1 ? 'it' : 'them'} yet. Open one to read Downstream, then publish or discard it.`, tone: 'warn', cls: 'lb-drafts', body: list(rows) });
  }
  function tile(title, n, paren, desc, href) {
    return `<a class="lb-tile" href="${esc(href)}"><span class="lb-tile-h"><span class="lb-tile-t">${esc(title)}</span> <b class="lb-tile-n">${esc(n)}</b>${paren ? ` <span class="lb-tile-p">${esc(paren)}</span>` : ''}</span><span class="lb-tile-d">${esc(desc)}</span></a>`;
  }
  function homeResults() {
    const n = needle('home'); if (!n) return '';
    const types = arr(call('libTypes', [], [])).filter((t) => hits(n, t.typeName)).map((t) => ({ title: t.typeName, href: `#/library/eq-types/${enc(t.code)}`, right: 'Equipment type' }));
    const ups = arr(call('upTypes', [], [])).filter((u) => hits(n, u.name)).map((u) => ({ title: u.name, href: `#/library/up-types/${enc(u.id)}`, right: 'Unit-process type' }));
    const tpls = arr(call('templates', [{ q: ST.q.home }], []));
    const all = [...ups, ...types];
    const tRows = tpls.slice(0, 12).map((t) => ({ title: t.name, href: t.href, sub: t.ownerName, right: t.chipText }));
    const more = tpls.length > 12 ? `<p class="small mt">${link(`All ${plural(tpls.length, 'template')} that match`, '#/library/templates')}</p>` : '';
    if (!all.length && !tpls.length) return empty(`Nothing in the library matches “${ST.q.home.trim()}”.`, btn('Clear the search', { act: 'lib:q-clear', data: { scope: 'home' } }));
    return section('Search results', (all.length ? list(all) : '') + (tRows.length ? list(tRows) : '') + more, { sub: `${plural(all.length, 'type')} · ${plural(tpls.length, 'template')}` });
  }
  function homePage() {
    const c = counts();
    const tiles = [
      tile('Plant types', c.plantTypes, '', 'The plant kinds with plants in this study. Each owns its plant rounds.', '#/library/plant-types'),
      tile('Unit-process types', c.upTypes, '', 'Basins and reactors, by stage. Identification proposes them; a person confirms each one.', '#/library/up-types'),
      tile('Equipment types', c.eqTypes, '', 'The types the survey stores, under their stored names.', '#/library/eq-types'),
      tile('Templates', c.templates, `(${c.trig} Trigger · ${c.task} Task)`, 'The library form of a Trigger or a Task: a limit rule per band, or a cadence, each with its own version.', '#/library/templates'),
      tile('Conditions', c.conditions, '', 'Reusable tests on a reading. Each template sets its own threshold.', '#/library/conditions'),
      tile('Flows', c.flows, `(${c.diag} diagnostic · ${c.action} action)`, 'Diagnostic flows find a root cause; action flows are the steps of a fix.', '#/library/flows'),
      tile('Root causes', c.causes, '', 'Where a diagnostic flow ends, each with its fix.', '#/library/root-causes'),
    ];
    const body = [
      draftsStrip(),
      `<div class="lb-tiles">${tiles.join('')}</div>`,
      searchBox('home', 'Search a type, a template or a reading'),
      homeResults(),
    ].filter(Boolean).join('');
    return libPage({ title: 'Library', sub: 'The shared definitions every plant follows.', active: 'home', body });
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     LISTS
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function counted(parts) { const p = parts.filter((x) => +x[0] > 0).map((x) => plural(x[0], x[1])); return p.length ? p.join(' · ') : H('<span class="muted">—</span>'); }
  function plantsLine(ps) { const a = arr(ps); return a.length ? a.map((p) => `${p.name} ${p.count}`).join(' · ') : ''; }

  /* #/library/eq-types */
  const SHOW_EQ = [['all', 'All'], ['used', 'Used at a plant'], ['anchor', 'A unit process sits on it'], ['draft', 'With a draft']];
  function eqShowOk(t, show) { return show === 'used' ? t.plantCount > 0 : show === 'anchor' ? !!t.anchor : show === 'draft' ? !!t.draft : true; }
  function eqTypesPage(params) {
    const q = (params && params._q) || {}; const types = arr(call('libTypes', [], []));
    const show = SHOW_EQ.some((s) => s[0] === q.show) ? q.show : 'all'; const n = needle('eq');
    const cnt = {}; SHOW_EQ.forEach(([id]) => { cnt[id] = types.filter((t) => eqShowOk(t, id)).length; });
    const shown = types.filter((t) => eqShowOk(t, show) && hits(n, t.typeName));
    const fams = []; shown.forEach((t) => { let f = fams.find((x) => x.name === t.family); if (!f) fams.push(f = { name: t.family, rows: [] }); f.rows.push(t); });
    const cols = [
      { label: 'Equipment type', render: (t) => H(`<a href="#/library/eq-types/${esc(enc(t.code))}">${esc(t.typeName)}</a>${t.anchor ? ' ' + chip('A unit process sits on it', { tone: 'info' }) : ''}${t.draft ? ' ' + chip('Draft', { tone: 'warn' }) : ''}`) },
      { label: 'Used at', render: (t) => (t.plantCount ? H(`${esc(plural(t.plantCount, 'plant'))}<div class="lb-sub">${esc(plantsLine(t.plants))}</div>`) : H('<span class="muted">Not used at a plant yet</span>')) },
      { label: 'Carries', render: (t) => (t.anchor ? H(`On the unit-process type: ${arr(t.movedTo).map((id) => `<a href="#/library/up-types/${esc(enc(id))}">${esc(upName(id))}</a>`).join(', ') || '—'}`) : counted([[t.alerts, 'Trigger template'], [t.tasks, 'Task template'], [t.issues, 'Issue type']])) },
      { label: 'Version', cls: 'r', render: (t) => H(`<span class="mono">v${esc(t.version)}</span>`) },
    ];
    const famHtml = fams.length
      ? fams.map((f) => section(f.name, table({ cols, rows: f.rows.map((t) => Object.assign({}, t, { _href: `#/library/eq-types/${enc(t.code)}` })) }), { sub: plural(f.rows.length, 'type') })).join('')
      : empty(n ? `No equipment type matches “${ST.q.eq.trim()}”.` : 'No equipment type here with this filter.', n ? btn('Clear the search', { act: 'lib:q-clear', data: { scope: 'eq' } }) : btn('Show every type', { href: '#/library/eq-types' }));
    const body = filters(SHOW_EQ.map(([id, label]) => ({ label, href: '#/library/eq-types' + qs({ show: id }), on: id === show, count: cnt[id] })))
      + searchBox('eq', 'Search an equipment type') + `<div class="lb-fams">${famHtml}</div>`;
    return libPage({
      title: 'Equipment types', active: 'eq-types', body,
      sub: `${plural(types.length, 'equipment type')} under the names the survey stores. ${plural(cnt.anchor, 'of them is', 'of them are')} a basin or reactor: in the plant graph each one is a unit process, and its content is on the unit-process type.`,
    });
  }

  /* #/library/up-types */
  function upTypesPage() {
    const ups = arr(call('upTypes', [], [])); const n = needle('up');
    const stageOrder = arr(V() && V().STAGES).map((s) => s.label);
    const shown = ups.filter((u) => hits(n, u.name, u.stageLabel, u.contentFromName));
    const groups = [];
    shown.forEach((u) => { let g = groups.find((x) => x.label === u.stageLabel); if (!g) groups.push(g = { label: u.stageLabel, rows: [] }); g.rows.push(u); });
    groups.sort((a, b) => (stageOrder.indexOf(a.label) < 0 ? 99 : stageOrder.indexOf(a.label)) - (stageOrder.indexOf(b.label) < 0 ? 99 : stageOrder.indexOf(b.label)));
    const row = (u) => {
      const tp = arr(u.templates); const trig = tp.filter((t) => t.kind === 'trigger').length; const task = tp.filter((t) => t.kind === 'task').length;
      const at = u.plantCount ? plantsLine(u.plants) : 'Not at any plant yet';
      return `<li class="row is-link" data-href="#/library/up-types/${esc(enc(u.id))}"><div class="row-main"><div class="row-t"><a href="#/library/up-types/${esc(enc(u.id))}">${esc(u.name)}</a> · ${esc(u.stageLabel)} · ${esc(at)}</div>`
        + `<div class="row-s">${esc([plural(trig, 'Trigger template'), plural(task, 'Task template'), plural(u.issues || 0, 'Issue type')].join(' · '))} · content first copied from ${esc(u.contentFromName || '—')}</div></div><div class="row-r"><span class="mono">v${esc(u.version)}</span></div></li>`;
    };
    const body = searchBox('up', 'Search a unit-process type')
      + (groups.length ? groups.map((g) => section(g.label, `<ul class="rows">${g.rows.map(row).join('')}</ul>`, { sub: plural(g.rows.length, 'type') })).join('')
        : empty(`No unit-process type matches “${String(ST.q.up || '').trim()}”.`, btn('Clear the search', { act: 'lib:q-clear', data: { scope: 'up' } })));
    return libPage({ title: 'Unit-process types', active: 'up-types', body, sub: `${plural(ups.length, 'unit-process type')}, by stage. A stage is only a label: nothing is filed on it. Each type carries the readings, Triggers, Tasks and Issues of its basins and reactors.` });
  }

  /* #/library/templates */
  const KIND_SHOW = [['all', 'All'], ['trigger', 'Trigger'], ['task', 'Task'], ['single', 'Single-use']];
  function tplWhat(t) {
    if (t.kind === 'trigger') {
      const bands = BANDS.filter((b) => t.rules && t.rules[b]).map((b) => `${BAND[b]} ${t.rules[b].text}`).join(' · ');
      return `Reads ${t.reading}, ${t.dirWord}${bands ? ` · ${bands}` : ''}`;
    }
    if (t.condition && t.condition.doWhen) return `Do when ${t.condition.reading} ${t.condition.op === 'below' ? 'falls below' : 'rises above'} ${t.condition.doWhen.text}${t.condition.doneWhen ? ` · done when ${t.condition.doneWhen.text}` : ''}`;
    return t.everyText || '—';
  }
  function ownerOptions(sel) {
    const ups = arr(call('upTypes', [], [])); const eqs = arr(call('libTypes', [], [])).filter((t) => !t.anchor); const pts = arr(call('plantTypes', [], []));
    const opt = (v, l) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`;
    return opt('', 'Every owner')
      + `<optgroup label="Unit-process types">${ups.map((u) => opt(`up:${u.id}`, u.name)).join('')}</optgroup>`
      + `<optgroup label="Equipment types">${eqs.map((t) => opt(`eq:${t.code}`, t.typeName)).join('')}</optgroup>`
      + `<optgroup label="Plant types">${pts.map((p) => opt(`plant:${p.id}`, p.name)).join('')}</optgroup>`;
  }
  const OWNER_RANK = { upType: 0, eqType: 1, plantType: 2 };
  function templatesPage(params) {
    const q = (params && params._q) || {}; const kind = KIND_SHOW.some((k) => k[0] === q.kind) ? q.kind : 'all'; const owner = q.owner || '';
    const all = arr(call('templates', [{}], []));
    const base = arr(call('templates', [owner ? { owner } : {}], []));
    const ok = (t, k) => (k === 'trigger' ? t.kind === 'trigger' : k === 'task' ? t.kind === 'task' : k === 'single' ? !!t.singleUse : true);
    const cnt = {}; KIND_SHOW.forEach(([id]) => { cnt[id] = base.filter((t) => ok(t, id)).length; });
    const n = needle('tpl');
    const rows = base.filter((t) => ok(t, kind) && hits(n, t.name, t.ownerName, t.reading))
      .sort((a, b) => ((a.singleUse ? 3 : OWNER_RANK[a.owner.kind] || 0) - (b.singleUse ? 3 : OWNER_RANK[b.owner.kind] || 0)) || String(a.ownerName).localeCompare(String(b.ownerName)) || (a.kind === b.kind ? 0 : a.kind === 'trigger' ? -1 : 1) || String(a.name).localeCompare(String(b.name)));
    const cols = [
      { label: 'Template', render: (t) => H(`<a href="${esc(t.href)}">${esc(t.name)}</a>${t.draft ? ' ' + chip('Draft', { tone: 'warn' }) : ''}${t.singleUse ? ' ' + chip(`Single-use · ${plantName(t.singleUse.plant)} only`, { tone: 'single' }) : ''}${t.flagged ? ' ' + chip('Scales with the plant', { tone: 'gap', title: 'This scales with the plant. Use a design parameter?' }) : ''}`) },
      { label: 'Kind', render: (t) => t.chipText },
      { label: 'Listed under', render: (t) => H(`<a href="${esc(ownerHref(t.owner))}">${esc(t.ownerName)}</a>`) },
      { label: 'What it does', render: (t) => tplWhat(t) },
    ];
    const tools = `<div class="lb-tools"><label class="lb-sel"><span>Listed under</span><select id="lbq-owner" data-act="lib:owner" data-kind="${esc(kind)}">${ownerOptions(owner)}</select></label>`
      + `<input type="search" id="lbq-tpl" placeholder="Search a template or a reading" aria-label="Search the templates" value="${esc(ST.q.tpl || '')}" data-act="lib:q" data-scope="tpl" data-live autocomplete="off">`
      + (ST.q.tpl ? btn('Clear', { act: 'lib:q-clear', data: { scope: 'tpl' }, small: true, kind: 'ghost' }) : '') + '</div>';
    const body = filters(KIND_SHOW.map(([id, label]) => ({ label, href: '#/library/templates' + qs({ kind: id, owner }), on: id === kind, count: cnt[id] })))
      + tools
      + (rows.length ? table({ cols, rows: rows.map((t) => Object.assign({}, t, { _href: t.href })), cls: 'lb-tpls' }) : empty('No template matches.', btn('Show every template', { href: '#/library/templates' })));
    return libPage({ title: 'Templates', active: 'templates', body, sub: `${plural(all.length, 'template')}: ${all.filter((t) => t.kind === 'trigger').length} Trigger · ${all.filter((t) => t.kind === 'task').length} Task. A Trigger template holds a limit rule per band, persistence and clearing; a Task template holds a cadence. Each has its own version.` });
  }

  /* #/library/plant-types */
  function plantTypesPage() {
    const pts = arr(call('plantTypes', [], []));
    const rows = pts.map((p) => ({ title: p.name, href: `#/library/plant-types/${enc(p.id)}`, chips: [chip(p.chipText, { tone: 'lib' })], sub: `${plural(arr(p.templates).length, 'Task template')} for plant rounds · ${arr(p.plants).length ? `Plants: ${arr(p.plants).map((x) => x.name).join(', ')}` : 'No plant yet'}` }));
    return libPage({ title: 'Plant types', active: 'plant-types', sub: 'The plant kinds with plants in this study. A plant type owns the rounds every plant of its kind walks.', body: list(rows) || empty('No plant type yet.') });
  }

  /* #/library/conditions/:id? */
  const CONDITIONS_SUB = "A Condition is a reusable test on a reading. Its threshold is set by each template's limit rule; edit it on the template.";
  function conditionsPage(params) {
    const id = params && params.id;
    if (id) {
      const c = call('condition', [id], null);
      if (!c) return libPage({ title: 'No such condition', active: 'conditions', body: empty('There is no such condition in the library.', btn('All conditions', { href: '#/library/conditions' })) });
      const rows = arr(c.uses).map((u) => ({ title: H(`<a href="#/library/templates/${esc(enc(u.templateId))}">${esc(u.templateName)}</a> ${esc(u.band ? BAND[u.band] : u.field === 'doneWhen' ? 'done when' : 'do when')}: ${esc(u.ruleText)}`), right: u.ownerName }));
      return libPage({ crumbs: [{ label: 'Library', href: '#/library' }, { label: 'Conditions', href: '#/library/conditions' }, { label: c.title }], title: c.title, chips: [chip(c.usedByText, { tone: 'lib' })], sub: CONDITIONS_SUB, active: 'conditions', body: section('Where it is used', list(rows) || empty('No template uses it.')) });
    }
    const n = needle('cond'); const all = arr(call('conditions', [], []));
    const rows = all.filter((c) => hits(n, c.title)).map((c) => ({ title: c.title, href: `#/library/conditions/${enc(c.id)}`, right: c.usedByText }));
    return libPage({ title: 'Conditions', active: 'conditions', sub: CONDITIONS_SUB, body: searchBox('cond', 'Search a reading') + (list(rows) || empty('No condition matches.', btn('Clear the search', { act: 'lib:q-clear', data: { scope: 'cond' } }))) });
  }

  /* #/library/flows/:id? */
  function flowName(id) { const f = arr(call('flows', [], [])).find((x) => x.id === id); return f ? f.name : null; }
  function causeName(id) { const c = arr(call('rootCauses', [], [])).find((x) => x.id === id); return c ? c.name : null; }
  function generalTaskName(id) {
    const lists = [W.ISSUE_TASKS, W.CTL && W.CTL.S && W.CTL.S.lib && W.CTL.S.lib.generalTasks];
    for (const l of lists) { const x = arr(l).find((t) => t && t.id === id); if (x && x.name) return x.name; }
    return null;
  }
  function answerHtml(a) {
    if (!a) return '';
    if (a.t === 'step') return `go to step ${esc(a.id)}`;
    if (a.t === 'cause') { const nm = causeName(a.id); return nm ? `root cause: <a href="#/library/root-causes/${esc(enc(a.id))}">${esc(nm)}</a>` : 'a root cause'; }
    if (a.t === 'open') return 'open an Issue';
    return esc(a.t || '');
  }
  function stepHtml(s) {
    const bits = [];
    if (s.type === 'reading') bits.push(chip(`Reading: ${s.sensorKind || 'a reading'}`, { tone: 'lib' }));
    if (s.type === 'wait') bits.push(chip(`Wait ${s.minutes != null ? s.minutes + ' min' : ''}`.trim(), { tone: 'lib' }));
    if (s.photo === 'required') bits.push(chip('Photo needed', { tone: 'lib' })); else if (s.photo === 'optional') bits.push(chip('Photo if useful', { tone: 'lib' }));
    if (s.approve) bits.push(chip('Needs approval', { tone: 'lib' }));
    const lks = [s.link].concat(arr(s.links)).filter((l) => l && l.kind === 'task');
    const linkLine = lks.length ? `<div class="lb-step-x">Opens the general task ${lks.map((l) => esc(generalTaskName(l.id) || 'from the workbook')).join(', ')}</div>` : '';
    const ans = s.answers ? `<ul class="lb-ans">${Object.keys(s.answers).map((k) => `<li><b>${esc(k)}</b> → ${answerHtml(s.answers[k])}</li>`).join('')}</ul>` : '';
    return `<li class="lb-step"><div class="lb-step-t">${esc(s.text || '')}${bits.length ? ' ' + bits.join(' ') : ''}</div>${linkLine}${ans}</li>`;
  }
  function flowsPage(params) {
    const id = params && params.id;
    if (id) {
      const f = call('flow', [id], null);
      if (!f) return libPage({ title: 'No such flow', active: 'flows', body: empty('There is no such flow in the library.', btn('All flows', { href: '#/library/flows' })) });
      const diag = f.kind === 'diagnostic';
      const usedBy = arr(call('templates', [{}], [])).filter((t) => t.flowId === id);
      const causes = arr(call('rootCauses', [], [])).filter((c) => c.fixFlowId === id);
      const extra = [
        usedBy.length ? section('Templates that start it', list(usedBy.map((t) => ({ title: t.name, href: t.href, right: t.ownerName })))) : '',
        causes.length ? section('The fix for', list(causes.map((c) => ({ title: c.name, href: `#/library/root-causes/${enc(c.id)}` })))) : '',
      ].join('');
      return libPage({
        crumbs: [{ label: 'Library', href: '#/library' }, { label: 'Flows', href: '#/library/flows' }, { label: f.name }], title: f.name, active: 'flows',
        chips: [chip(diag ? 'Diagnostic flow' : 'Action flow', { tone: 'lib' }), f.version != null ? chip(`Version ${f.version}`, { tone: 'lib' }) : ''],
        sub: arr(f.forTypes).length ? `For ${joinAnd(f.forTypes)}.` : '',
        body: card({ title: diag ? 'Questions, in order' : 'Steps, in order', sub: plural(arr(f.steps).length, 'step'), body: `<ol class="lb-steps">${arr(f.steps).map(stepHtml).join('')}</ol>` }) + extra,
      });
    }
    const n = needle('flow'); const all = arr(call('flows', [], []));
    const sec = (title, rows) => (rows.length ? section(title, table({ cols: [{ label: 'Flow', render: (f) => H(`<a href="#/library/flows/${esc(enc(f.id))}">${esc(f.name)}</a>`) }, { label: 'Steps', cls: 'r', render: (f) => String(f.steps) }, { label: 'Version', cls: 'r', render: (f) => (f.version != null ? String(f.version) : '—') }], rows: rows.map((f) => Object.assign({}, f, { _href: `#/library/flows/${enc(f.id)}` })) }), { sub: plural(rows.length, 'flow') }) : '');
    const shown = all.filter((f) => hits(n, f.name));
    const body = searchBox('flow', 'Search a flow')
      + (shown.length ? sec('Diagnostic flows', shown.filter((f) => f.kind === 'diagnostic')) + sec('Action flows', shown.filter((f) => f.kind !== 'diagnostic'))
        : empty('No flow matches.', btn('Clear the search', { act: 'lib:q-clear', data: { scope: 'flow' } })));
    return libPage({ title: 'Flows', active: 'flows', sub: 'A diagnostic flow asks questions until it reaches a root cause; an action flow lists the steps of a fix. Read-only here.', body });
  }

  /* #/library/root-causes/:id? */
  function causesPage(params) {
    const id = params && params.id;
    if (id) {
      const c = call('rootCause', [id], null);
      if (!c) return libPage({ title: 'No such root cause', active: 'root-causes', body: empty('There is no such root cause in the library.', btn('All root causes', { href: '#/library/root-causes' })) });
      const fixName = c.fix ? flowName(c.fix) : null;
      const from = arr(call('flows', [], [])).filter((f) => f.kind === 'diagnostic').filter((f) => arr((call('flow', [f.id], {}) || {}).steps).some((s) => s && s.answers && Object.keys(s.answers).some((k) => s.answers[k] && s.answers[k].t === 'cause' && s.answers[k].id === id)));
      const body = card({ body: kv([['Found on', arr(c.types).join(', ') || '—'], ['Fix', fixName ? H(`<a href="#/library/flows/${esc(enc(c.fix))}">${esc(fixName)}</a>`) : '—']]) })
        + (from.length ? section('Diagnostic flows that end here', list(from.map((f) => ({ title: f.name, href: `#/library/flows/${enc(f.id)}` })))) : '');
      return libPage({ crumbs: [{ label: 'Library', href: '#/library' }, { label: 'Root causes', href: '#/library/root-causes' }, { label: c.name }], title: c.name, active: 'root-causes', chips: [chip('Root cause', { tone: 'lib' })], body });
    }
    const n = needle('cause'); const all = arr(call('rootCauses', [], []));
    const rows = all.filter((c) => hits(n, c.name, arr(c.types).join(' ')));
    const cols = [
      { label: 'Root cause', render: (c) => H(`<a href="#/library/root-causes/${esc(enc(c.id))}">${esc(c.name)}</a>`) },
      { label: 'Found on', render: (c) => arr(c.types).join(', ') || '—' },
      { label: 'Fix', render: (c) => { const nm = c.fixFlowId ? flowName(c.fixFlowId) : null; return nm ? H(`<a href="#/library/flows/${esc(enc(c.fixFlowId))}">${esc(nm)}</a>`) : '—'; } },
    ];
    return libPage({ title: 'Root causes', active: 'root-causes', sub: 'Where a diagnostic flow ends. Each has the action flow that fixes it. Read-only here.', body: searchBox('cause', 'Search a root cause or a type') + (rows.length ? table({ cols, rows: rows.map((c) => Object.assign({}, c, { _href: `#/library/root-causes/${enc(c.id)}` })) }) : empty('No root cause matches.', btn('Clear the search', { act: 'lib:q-clear', data: { scope: 'cause' } }))) });
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     TYPE PAGES  (the one object page in type mode; a read-only page of its own without object7's type mode)
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const TYPE_TABS = [['readings', 'Readings'], ['issues', 'Issues'], ['tasks', 'Tasks'], ['details', 'Details']];
  function typeBanner(code) {
    const t = call('libType', [code], null); if (!t || !t.anchor || !t.banner) return '';
    const moved = arr(t.movedToTypes);
    const cut = t.banner.lastIndexOf(': ');
    const head = cut > 0 ? t.banner.slice(0, cut + 2) : t.banner + ' ';
    const links = moved.map((m) => `<a href="${esc(m.href || `#/library/up-types/${enc(m.id)}`)}">${esc(m.name)}</a>`).join(', ');
    return bannerOf(H(`${esc(head)}${links}.`), { tone: 'info' });
  }
  function viaObject(o, marker) {
    const O = W.V7OBJ; if (!O || typeof O.render !== 'function') return null;
    let out = null;
    try { out = O.render(o); } catch (e) { soft(e); return null; }
    out = out == null ? '' : String(out);
    return out && out.indexOf(marker) >= 0 ? out : null;
  }
  function notFound(what, back, href) {
    return libPage({ title: `No such ${what}`, active: back, body: empty(`There is no such ${what} in the library.`, btn('Back to the library', { href: href || '#/library' })) });
  }
  function eqTypePage(params) {
    const code = params && params.code; const t = call('libType', [code], null);
    if (!t) return notFound('equipment type', 'eq-types', '#/library/eq-types');
    const tab = TYPE_TABS.some((x) => x[0] === (params && params.tab)) ? params.tab : 'readings';
    const q = (params && params._q) || {}; const owner = { kind: 'eqType', code, typeName: t.typeName };
    const aside = downstreamAside(owner, q);
    const out = viaObject({ mode: 'eqType', code, tab, aside, q, query: q }, 'Equipment type · v');
    if (out) { ST.last.type = 'object7'; return out; }
    ST.last.type = 'lib7';
    return typeFallback('eqType', t, tab, aside, q);
  }
  function upTypePage(params) {
    const id = params && params.id; const u = call('upTypeView', [id], null);
    if (!u) return notFound('unit-process type', 'up-types', '#/library/up-types');
    const tab = TYPE_TABS.some((x) => x[0] === (params && params.tab)) ? params.tab : 'readings';
    const q = (params && params._q) || {}; const owner = { kind: 'upType', id, typeName: u.name };
    const aside = downstreamAside(owner, q);
    const out = viaObject({ mode: 'upType', id, tab, aside, q, query: q }, 'Unit-process type · v');
    if (out) { ST.last.type = 'object7'; return out; }
    ST.last.type = 'lib7';
    return typeFallback('upType', u, tab, aside, q);
  }
  /* one card per reading and direction: the template, its limit rules, its chip, the constant flag, and where it resolves */
  function readingCards(readings) {
    const out = [];
    arr(readings).forEach((r) => {
      const dirs = arr(r.dirs);
      if (!dirs.length) { out.push(card({ title: r.name, cls: 'lb-rd lb-rd-none', body: '<p class="muted">No Trigger template reads it.</p>' })); return; }
      dirs.forEach((d) => {
        const flagBand = BANDS.find((b) => d.rules && d.rules[b] && d.rules[b].flag) || null;
        const flag = d.flagText ? `<div class="lb-flag">${chip(d.flagText, { tone: 'gap' })} ${editTemplateButton(d.templateId, { band: flagBand, mode: 'expr', label: 'Use a design parameter' })}</div>` : '';
        const ra = arr(d.resolvesAt);
        const raHtml = `<div class="lb-ra"><p class="lb-k">Resolves at:</p>${ra.length ? `<ul>${ra.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>` : '<p class="muted small">No plant has this reading yet.</p>'}</div>`;
        out.push(card({
          title: H(`<a href="#/library/templates/${esc(enc(d.templateId))}">${esc(d.title)}</a>`), sub: `${r.name} · ${d.dirWord}`, cls: 'lb-rd',
          actions: [editTemplateButton(d.templateId, {})],
          body: `<p class="lb-rules">${esc(d.rulesText || 'No band')}</p><div class="lb-chips">${chipHtml(d.chip)}</div>${flag}${raHtml}`,
        }));
      });
    });
    return out.join('') || empty('No readings for this type in the library.');
  }
  function foundBy(i) {
    const k = arr(i.foundBy).length ? arr(i.foundBy) : arr(i.detection).map((d) => d && d.kind);
    const words = { sensor: 'a reading', visual: 'a person looking', lab: 'a lab test', manual: 'a hand test' };
    const ws = [...new Set(k.filter(Boolean).map((x) => words[x] || x))];
    return ws.length ? `Found by ${joinAnd(ws)}` : '';
  }
  function issuesHtml(issues) {
    const rows = arr(issues).map((i) => {
      const fn = i.flowId ? flowName(i.flowId) : null;
      return { title: i.name, sub: H(`${esc(foundBy(i))}${fn ? ` · Diagnostic flow: <a href="#/library/flows/${esc(enc(i.flowId))}">${esc(fn)}</a>` : ''}`) };
    });
    return list(rows) || empty('No Issue types for this type in the workbook.');
  }
  function cadenceText(s) {
    if (s.condition && s.condition.doWhen) return `Do when ${s.condition.reading} ${s.condition.op === 'below' ? 'falls below' : 'rises above'} ${s.condition.doWhen.text}${s.condition.doneWhen ? ` · done when ${s.condition.doneWhen.text}` : ''}`;
    return s.everyText || '—';
  }
  function tasksHtml(schedules, general) {
    const tp = table({
      cols: [
        { label: 'Task template', render: (s) => H(`<a href="#/library/templates/${esc(enc(s.id))}">${esc(s.name)}</a>`) },
        { label: 'Cadence', render: (s) => cadenceText(s) },
        { label: 'Kind of work', render: (s) => workLabel(s.workType) },
        { label: '', render: (s) => H(editTemplateButton(s.id, {})) },
      ],
      rows: arr(schedules), empty: 'No Task templates on this type.',
    });
    const g = arr(general);
    const gen = g.length ? section('General tasks from the workbook', table({ cols: [{ label: 'Task', key: 'name' }, { label: 'Kind of work', render: (x) => workLabel(x.workType) }, { label: 'Cadence in the workbook', render: (x) => String(x.frequency || '—').replace(/\s*\n\s*/g, ' · ') }], rows: g }), { sub: 'A step of an action flow opens one of these. They are not scheduled.' }) : '';
    return section('Task templates', tp, { sub: 'Each Task sits on one subject at each plant: a unit process, a piece of equipment or the plant.' }) + gen;
  }
  function paramsUsed(tpls) {
    const P = (V() && V().PARAMS) || {}; const keys = new Set();
    arr(tpls).forEach((t) => {
      BANDS.forEach((b) => { const r = t.rules && t.rules[b] && t.rules[b].rule; if (r && r.kind === 'expr') keys.add(r.param); });
      if (t.condition) ['doWhen', 'doneWhen'].forEach((k) => { const r = t.condition[k] && t.condition[k].rule; if (r && r.kind === 'expr') keys.add(r.param); });
    });
    return [...keys].map((k) => (P[k] && P[k].label) || k);
  }
  function typeFallback(kind, view, tab, aside, q) {
    const up = kind === 'upType'; const code = view.code; const id = view.id;
    const base = up ? `#/library/up-types/${enc(id)}` : `#/library/eq-types/${enc(code)}`;
    const name = up ? view.name : view.typeName;
    const ps = arr(view.plants);
    let body = '';
    if (tab === 'readings') body = (!up && view.anchor ? '' : readingCards(view.readings)) + (!up && arr(view.nextPhase && view.nextPhase.readings).length ? note(`Next phase: readings on connections, ${arr(view.nextPhase.readings).map((x) => x.name).join(', ')}.`, 'next') : '');
    else if (tab === 'issues') body = !up && view.anchor ? '' : issuesHtml(view.issues);
    else if (tab === 'tasks') body = !up && view.anchor ? '' : tasksHtml(view.schedules, up ? [] : view.generalTasks);
    else {
      const used = ps.length ? ps.map((p) => `${p.name} ${p.count}`).join(' · ') : 'Not used at a plant yet';
      const pu = paramsUsed(up ? view.templates : [...arr(view.alerts), ...arr(view.schedules)]);
      body = up
        ? card({ title: 'Unit-process type', body: kv([['Stage', view.stageLabel], ['Identified from', arr(view.identifiedFrom).join(', ') || '—'], ['Expected participants', arr(view.expected).join(', ') || 'None'], ['Content first copied from', view.contentFromName || '—'], ['Design parameters its limit rules use', pu.join(', ') || 'None'], ['Used at', used], ['Version', `v${view.version}`]]) })
        : card({ title: 'Equipment type', body: kv([['Family', view.family || '—'], ['Design parameters its limit rules use', pu.join(', ') || 'None'], ['Default criticality tier', (view.details && view.details.defaultTier) || view.tier || '—'], ['Used at', used], ['Version', `v${view.version}`]]) });
    }
    if (!up && view.anchor && tab !== 'details') body = empty('Every one of these in the plant graph is a unit process: its content is on the unit-process type above.', btn('Details', { href: `${base}/details` }));
    return page({
      crumbs: [{ label: 'Library', href: '#/library' }, up ? { label: 'Unit-process types', href: '#/library/up-types' } : { label: 'Equipment types', href: '#/library/eq-types' }, { label: name }],
      title: name,
      chips: [chip(view.chipText || `${up ? 'Unit-process' : 'Equipment'} type · v${view.version}`, { tone: 'lib' }), up ? chip(`Stage: ${view.stageLabel}`) : chip(view.family || ''), chip(ps.length ? `Used at ${plural(ps.length, 'plant')}` : 'Not used at a plant yet'), !up && view.anchor ? chip('A unit process sits on it', { tone: 'info' }) : ''],
      sub: up ? `Content first copied from ${view.contentFromName}. Templates listed here reach every unit process of this type that follows them.` : view.anchor ? '' : 'Templates listed here reach every piece of equipment of this type that follows them.',
      banner: (up ? '' : typeBanner(code)) + (arr(view.templates).some((x) => x && x.draft) || ownerTemplates(up ? { kind: 'upType', id } : { kind: 'eqType', code }).some((x) => x.draft) ? bannerOf(`Library · edits reach every plant that follows. You're editing v${view.version}.`, { tone: 'warn' }) : ''),
      tabs: TYPE_TABS.map(([tid, label]) => ({ id: tid, label, href: `${base}/${tid}` })), active: tab, body, aside, cls: 'pg-lib pg-lib-type',
    });
  }

  /* #/library/plant-types/:id/:tab? */
  const PT_TABS = [['tasks', 'Tasks'], ['types', 'Types offered'], ['plants', 'Plants']];
  function plantTypePage(params) {
    const id = params && params.id; const pv = call('plantTypeView', [id], null);
    if (!pv) return notFound('plant type', 'plant-types', '#/library/plant-types');
    const tab = PT_TABS.some((x) => x[0] === (params && params.tab)) ? params.tab : 'tasks';
    const base = `#/library/plant-types/${enc(id)}`; const q = (params && params._q) || {};
    let body = '';
    if (tab === 'tasks') body = tasksHtml(pv.templates, []);
    else if (tab === 'types') {
      const ups = arr(pv.upTypes).map((u) => ({ title: upName(u), href: `#/library/up-types/${enc(u)}` }));
      const eqs = arr(pv.eqTypes).map((c) => { const t = call('libType', [c], null); return t ? { title: t.typeName, href: `#/library/eq-types/${enc(c)}` } : null; }).filter(Boolean);
      body = section('Unit-process types', list(ups) || empty('None at its plants yet.'), { sub: `Seen at the ${pv.name} plants in this study.` }) + section('Equipment types', list(eqs) || empty('None at its plants yet.'));
    } else {
      body = list(arr(pv.plants).map((p) => { const pl = plants().find((x) => x.key === p.key) || {}; return { title: p.name, href: `#/p/${enc(p.key)}`, chips: [pl.state ? UI.stateChip(pl.state) : ''] }; })) || empty(`No ${pv.name} in this study yet.`);
    }
    return page({
      crumbs: [{ label: 'Library', href: '#/library' }, { label: 'Plant types', href: '#/library/plant-types' }, { label: pv.name }], title: pv.name,
      chips: [chip(pv.chipText, { tone: 'lib' }), chip(`${plural(arr(pv.plants).length, 'plant')}`)], sub: `The rounds every ${pv.name} walks, and the types its plants use.`,
      tabs: PT_TABS.map(([tid, label]) => ({ id: tid, label, href: `${base}/${tid}` })), active: tab, body, aside: downstreamAside({ kind: 'plantType', id }, q), cls: 'pg-lib pg-lib-type',
    });
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     THE ASIDE OF A TYPE PAGE: Downstream + Publish for every draft on its templates; else what the type reaches
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function overridesFor(owner) {
    const tk = ownerKey(owner); const cd = ownerCode(owner);
    return arr(call('overrides', [{}], [])).filter((o) => o && (o.typeKey === tk || (o.ownerCode && o.ownerCode === cd && (!o.typeKey || o.typeKey === tk))));
  }
  function variantsFor(owner) {
    const seen = new Set(); const out = [];
    [ownerKey(owner), ownerCode(owner)].forEach((k) => { if (!k) return; arr(call('variantRequests', [k], [])).forEach((r) => { if (r && !seen.has(r.id)) { seen.add(r.id); out.push(r); } }); });
    return out.sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  function variantCard(owner) {
    const rs = variantsFor(owner);
    const body = rs.length
      ? `<ul class="lb-vr">${rs.map((r) => `<li><p>${esc([r.atText || fmtDate(r.at), r.plantName || (r.plant ? plantName(r.plant) : 'All plants'), `“${r.trait}”`].join(' · '))}${r.note ? ` · ${esc(r.note)}` : ''} · ${esc(r.whoText || r.who || '')}</p>${r.fromText ? `<p class="small muted">From an override: ${esc(r.fromText)}</p>` : ''}</li>`).join('')}</ul>`
      : '<p class="muted small">No variant requests.</p>';
    return card({ title: 'Variant requests', sub: 'Requests from plants, newest first. Nothing changes until someone builds a variant and publishes it.', cls: 'lb-side', body });
  }
  function historyCard(owner) {
    const v = ownerView(owner); const ch = arr(v && v.changes);
    if (!ch.length) return card({ title: 'Version history', cls: 'lb-side', body: `<p class="muted small">Nothing published since v1.</p>` });
    return card({ title: 'Version history', cls: 'lb-side', body: `<ul class="lb-hist">${ch.map((c) => `<li><p><b>${esc(c.name || c.typeName || '')} v${esc(c.v || c.version)}</b> · ${esc(fmtDate(c.at))} · ${esc(KIND_LABEL[c.kind] || cap(c.kind))}</p><p class="small">${esc(c.text || '')}${c.note ? ` · ${esc(c.note)}` : ''}</p></li>`).join('')}</ul>` });
  }
  function typeSummaryCard(owner) {
    const v = ownerView(owner); if (!v) return '';
    const ovs = overridesFor(owner); const moved = ovs.filter((o) => o.isBaseMoved || o.state === 'basemoved').length;
    const tpls = ownerTemplates(owner);
    const ps = owner.kind === 'plantType' ? arr(v.plants).map((p) => ({ name: p.name, key: p.key })) : arr(v.plants);
    const used = ps.length ? `<p class="lb-k">Used at</p><ul class="lb-used">${ps.map((p) => `<li><a href="#/p/${esc(enc(p.key))}">${esc(p.name)}</a>${p.count != null ? `<span class="mono">${esc(p.count)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted small">Not used at a plant yet: a change here reaches no plant today.</p>';
    const ovLine = owner.kind === 'plantType' ? '' : `<p class="lb-ovl">${link(`Overrides at plants: ${ovs.length} · ${moved} base moved`, `#/deviations${qs({ template: ownerKey(owner) })}`)}</p>`;
    const anchor = owner.kind === 'eqType' && v.anchor;
    const lead = anchor
      ? `<p class="small">Its content is on the unit-process type: ${arr(v.movedToTypes).map((m) => `<a href="${esc(m.href || `#/library/up-types/${enc(m.id)}`)}">${esc(m.name)}</a>`).join(', ') || '—'}. Edit its templates there.</p>`
      : `<p class="small">${esc(`${plural(tpls.filter((t) => t.kind === 'trigger').length, 'Trigger template')} · ${plural(tpls.filter((t) => t.kind === 'task').length, 'Task template')}.`)} Edit a template: it becomes a draft, and Downstream shows every plant it reaches before you publish.</p>`;
    const body = `${lead}${used}${anchor ? '' : ovLine}`;
    return card({ title: v.chipText || `v${v.version}`, sub: owner.kind === 'eqType' ? v.family : owner.kind === 'upType' ? `Stage: ${v.stageLabel}` : '', cls: 'lb-side', body });
  }
  function tierPromoteCard(owner, ovId) {
    const o = call('overrideById', [ovId], null);
    if (!o || o.kind !== 'tier') return '';
    if (o.status && o.status !== 'active') return card({ title: 'Promote', cls: 'lb-side', body: `<p class="small">This override is ${esc(String(o.stateLabel || o.status).toLowerCase())}: there is nothing to promote.</p>` });
    const F = ST.typepub[ovId] || (ST.typepub[ovId] = { note: '' });
    const v = ownerView(owner); const next = (v && v.version ? +v.version : 1) + 1;
    const body = bannerOf(o.promoteBanner, { tone: 'info' })
      + kv([['Default criticality tier', `${o.currentBaseText != null ? o.currentBaseText : '—'} → ${o.valueText || o.value}`], ['Plants with one', arr(v && v.plants).map((p) => p.name).join(', ') || 'None yet']])
      + field({ label: 'Change note', hint: 'Required. It goes into the version history and the All Plants Activity.', html: `<textarea id="tp-tier-${esc(ovId)}" rows="3" placeholder="What changed, and why" data-act="tpl:pubfield" data-tier="${esc(ovId)}" data-name="note" data-live>${esc(F.note || '')}</textarea>` });
    return card({ title: 'Promote a criticality tier', sub: `A Minor change to ${ownerName(owner)}: plants that follow change at once.`, tone: 'info', cls: 'lb-side', body, foot: btn(`Publish v${next} of ${ownerName(owner)}`, { act: 'tpl:typepub', data: { type: ownerKey(owner), ov: ovId }, kind: 'primary' }) });
  }
  function downstreamAside(owner, query) {
    const q = query || {}; if (!owner) return '';
    const parts = [];
    if (q.promote) parts.push(tierPromoteCard(owner, q.promote));
    const drafts = ownerTemplates(owner).filter((t) => t.draft);
    drafts.forEach((t) => parts.push(`<div class="lb-dsx"><p class="lb-dsx-h">${link(`${t.name} · draft v${t.v + 1}`, t.href)}</p>${draftPanel(t.id)}</div>`));
    if (!drafts.length) parts.push(typeSummaryCard(owner));
    if (owner.kind !== 'plantType') parts.push(variantCard(owner));
    parts.push(historyCard(owner));
    return `<div class="lb-aside">${parts.filter(Boolean).join('')}</div>`;
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     DOWNSTREAM: before an edit (who follows each field), and with a draft (what each plant does) + Publish
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function usesOf(id) { return arr((call('template', [id], null) || {}).uses); }
  /* the instances behind a count, classed per instance so each entry links to its own field */
  function beforeEntries(id, f, key) {
    const uses = usesOf(id); const fld = String(f.field || ''); const band = fld.indexOf('band.') === 0 ? fld.slice(5) : null;
    const plantsIn = arr(f[key]);
    const out = [];
    plantsIn.forEach((p) => {
      let xs = [];
      if (band) {
        xs = uses.filter((u) => u.kind === 'zone' && u.plant === p).filter((u) => {
          const pb = (((call('zoneInfo', [p, u.sensorId, u.dir], null) || {}).perBand) || {})[band] || {};
          const cls = pb.pinnedTo != null ? 'pinned' : (pb.overrideId || pb.source === 'override') ? 'override' : 'follow';
          return cls === key;
        }).map((u) => ({ text: `${plantName(p)} · ${u.tag}`, href: `#/p/${enc(p)}/sensor/${enc(u.sensorId)}?f=zone.${u.dir}.${band}` }));
      } else if (fld === 'hold' || fld === 'clear') {
        xs = uses.filter((u) => u.kind === 'trigger' && u.plant === p).map((u) => ({ text: `${plantName(p)} · ${u.name}`, href: `#/p/${enc(p)}/trigger/${enc(u.alertId)}?f=${fld === 'hold' ? 'persistence' : 'clearing'}` }));
      } else if (fld === 'doWhen' || fld === 'doneWhen') {
        xs = uses.filter((u) => u.kind === 'work' && u.plant === p).map((u) => ({ text: `${plantName(p)} · ${u.name}${u.tag ? ` on ${u.tag}` : ''}`, href: `#/p/${enc(p)}/trigger/${enc(u.workId)}` }));
      } else {
        xs = uses.filter((u) => u.kind === 'schedule' && u.plant === p).map((u) => ({ text: `${plantName(p)} · ${u.name}${u.tag ? ` on ${u.tag}` : ''}`, href: `#/p/${enc(p)}/trigger/${enc(u.scheduleId)}?f=cadence` }));
      }
      if (!xs.length) xs = [{ text: plantName(p), href: `#/p/${enc(p)}` }];
      out.push(...xs);
    });
    return out;
  }
  function countCell(id, f, key) {
    const n = (f.counts && f.counts[key]) || 0;
    if (!n) return H('<span class="muted">0</span>');
    const es = beforeEntries(id, f, key);
    return H(`<details class="ds-x"><summary>${esc(n)}</summary><ul>${es.map((e) => `<li><a href="${esc(e.href)}">${esc(e.text)}</a></li>`).join('')}</ul></details>`);
  }
  function frozenCell(f) {
    const fz = arr(f.frozen); if (!fz.length) return H('<span class="muted">0</span>');
    return H(`<span class="ds-fzn">${esc(fz.length)}</span><ul class="ds-fz">${fz.map((x) => `<li><a href="#/p/${esc(enc(x.plant))}/trigger/${esc(enc(x.alertId))}">${esc(`${x.name} (${x.why})`)}</a></li>`).join('')}</ul>`);
  }
  function beforeCard(id, ds) {
    const b = ds && ds.before; if (!b) return '';
    const head = arr(b.head).length === 5 ? b.head : ['Field', 'Follow', 'Override', 'Pinned', 'Frozen'];
    const tbl = table({
      cols: [
        { label: head[0], render: (f) => f.label },
        { label: head[1], cls: 'r', render: (f) => countCell(id, f, 'follow') },
        { label: head[2], cls: 'r', render: (f) => countCell(id, f, 'override') },
        { label: head[3], cls: 'r', render: (f) => countCell(id, f, 'pinned') },
        { label: head[4], render: (f) => frozenCell(f) },
      ],
      rows: arr(b.perField), cls: 'ds-before', empty: 'No field to follow yet.',
    });
    return card({ title: 'Downstream', sub: b.sub, cls: 'ds lb-side', body: tbl + '<p class="small muted mt">Counts are plants; Frozen counts Triggers. Edit a field to make a draft: Downstream then shows what each plant does before you publish.</p>' });
  }
  const GROUP_CLASS = { update: 'update', baseMoved: 'baseMoved', clears: 'clears', pinned: 'pinned', frozen: 'frozen', held: 'held', suspended: 'suspended', gap: 'gap', newDraft: 'newDraft' };
  function groupHtml(f, g) {
    const items = arr((f.classes || {})[GROUP_CLASS[g.key] || g.key]);
    const whys = arr(g.why);
    const lis = arr(g.items).map((t, i) => {
      const it = items[i] || {}; const why = g.key === 'update' ? (whys[i] || it.why) : null;
      return `<li>${it.link ? `<a href="${esc(it.link)}">${esc(t)}</a>` : esc(t)}${why ? ` <span class="ds-why">(${esc(why)})</span>` : ''}</li>`;
    }).join('');
    return `<div class="ds-g ds-g-${esc(g.key)}"><p class="ds-k">${esc(g.head)}</p>${lis ? `<ul class="ds-l">${lis}</ul>` : ''}</div>`;
  }
  function resolvesHtml(ds) {
    const rs = arr(ds.resolves); if (!rs.length) return '';
    const consts = rs.filter((r) => r.constant).map((r) => `<p class="ds-r">${esc(r.text)}</p>`).join('');
    const ex = rs.filter((r) => !r.constant);
    const tbl = ex.length ? table({ cols: [{ label: 'Plant', render: (r) => String(r.text || '').split(' | ')[0] }, { label: 'Resolves to', render: (r) => String(r.text || '').split(' | ')[1] || '—' }, { label: 'From', render: (r) => String(r.text || '').split(' | ')[2] || '—' }], rows: ex, cls: 'ds-res' }) : '';
    return `<div class="ds-rs">${consts}${tbl}</div>`;
  }
  function dueNowHtml(id, ds, F) {
    const d = ds.dueNow; if (!d || !d.service) return '';
    const sv = d.service; const lab = sv.labels || {}; const cf = F.countFrom || d.countFrom || 'service';
    const opt = (val, label) => `<label class="radio${cf === val ? ' on' : ''}"><input type="radio" name="cf-${esc(id)}" value="${val}"${cf === val ? ' checked' : ''} data-act="tpl:countfrom" data-id="${esc(id)}"><span><b>${esc(label)}</b></span></label>`;
    const tasks = [].concat(...arr((cf === 'publish' && d.publish ? d.publish : sv).plants).map((p) => arr(p.tasks).map((x) => `${p.name} · ${x.text}`)));
    return `<div class="ds-due"><p class="ds-k">${esc(sv.text || '')}</p><div class="radios" role="radiogroup" aria-label="Where counting starts">${opt('service', lab.service || 'Count from the last service')}${opt('publish', lab.publish || 'Count from the publish date')}</div>`
      + (tasks.length ? `<details class="ds-x"><summary>${esc(plural(tasks.length, 'Task'))} it moves</summary><ul>${tasks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '') + '</div>';
  }
  function kindRadios(id, ds, kind) {
    const titles = ds.kindTitles || {}; const allowed = arr(ds.allowedKinds);
    return `<div class="radios ds-kinds" role="radiogroup" aria-label="Version">${KINDS.map((k) => {
      const dis = !allowed.includes(k); const on = k === kind;
      return `<label class="radio${on ? ' on' : ''}${dis ? ' is-off' : ''}"${titles[k] ? ` title="${esc(titles[k])}"` : ''}><input type="radio" name="kind-${esc(id)}" value="${k}"${on ? ' checked' : ''}${dis ? ' disabled' : ''} data-act="tpl:pubkind" data-id="${esc(id)}"><span><b>${esc(KIND_LABEL[k])}</b><small>${esc(KIND_SUB[k])}</small></span></label>`;
    }).join('')}</div>`;
  }
  function currentDs(id) {
    const F = pubForm(id);
    let ds = call('downstream', [id, {}], null);
    if (!ds || !ds.draft) return { ds, F };
    if (F.kind && !arr(ds.allowedKinds).includes(F.kind)) delete F.kind;
    if (F.kind || F.countFrom) ds = call('downstream', [id, { kind: F.kind || ds.suggestedKind, countFrom: F.countFrom }], ds);
    return { ds, F };
  }
  function draftPanel(id) {
    const { ds, F } = currentDs(id); if (!ds || !ds.draft) return '';
    const kind = F.kind || ds.kind || ds.suggestedKind;
    const diffs = arr(ds.draft.diffs);
    const draftCard = card({
      title: `Draft v${ds.nextVersion}`, sub: `Changes to v${ds.v}. Not published: no plant sees them yet.`, tone: 'warn', cls: 'ds-draft lb-side',
      body: `<ul class="ds-diffs">${diffs.map((d) => `<li>${esc(d.text)}</li>`).join('')}</ul>`,
    });
    const fields = arr(ds.fields).map((f) => `<div class="ds-f"><h3 class="ds-fh">${esc(f.heading)}</h3>${arr(f.groups).map((g) => groupHtml(f, g)).join('')}</div>`).join('');
    const lines = arr(ds.lines).map((l) => `<p class="ds-n">${esc(l)}</p>`).join('');
    const down = card({ title: 'Downstream', sub: ds.text, cls: 'ds lb-side', body: fields + resolvesHtml(ds) + dueNowHtml(id, ds, F) + lines });
    const noteF = field({ label: 'Change note', hint: 'Required. It goes into the version history and the All Plants Activity.', html: `<textarea id="pub-${esc(id)}-note" rows="3" placeholder="What changed, and why" data-act="tpl:pubfield" data-id="${esc(id)}" data-name="note" data-live>${esc(F.note || '')}</textarea>` });
    const reasonF = kind === 'forced' ? field({ label: 'Why is this forced?', hint: 'Required for a Forced change.', html: `<textarea id="pub-${esc(id)}-reason" rows="2" placeholder="The reason, in a sentence" data-act="tpl:pubfield" data-id="${esc(id)}" data-name="reason" data-live>${esc(F.reason || '')}</textarea>` }) : '';
    const pub = card({
      title: 'Publish', cls: 'ds-pub lb-side',
      body: `<p class="ds-ver">${esc(ds.versionText || '')}</p>${kindRadios(id, ds, kind)}${noteF}${reasonF}`,
      foot: btn(ds.publishLabel || `Publish v${ds.nextVersion}`, { act: 'tpl:publish', data: { id }, kind: 'primary' }) + btn('Discard draft', { act: 'tpl:discard', data: { id }, kind: 'ghost' }),
    });
    return draftCard + down + pub;
  }
  function forcedCard(id, t) {
    if (!t || !t.forced) return '';
    const ch = arr(call('libChanges', [{ templateId: id }], [])).find((c) => c.kind === 'forced') || null;
    const c = call('chipFor', [{ src: 'forced', template: t.name, v: ch ? ch.v : t.v }], null) || { text: `Forced by library · ${t.name} v${ch ? ch.v : t.v}`, tone: 'forced' };
    return card({ title: H(chipHtml(c)), cls: 'lb-side', tone: 'bad', body: `<p class="small">${esc(ch ? `In force since ${fmtDate(ch.at)}. Reason: ${ch.reason || '—'}` : 'In force.')} Overrides on its Emergency band are suspended until it is lifted.</p>`, foot: btn('Lift the Forced change…', { act: 'tpl:lift', data: { id }, kind: 'ghost' }) });
  }
  function templateAside(id) {
    const t = call('template', [id], null); if (!t) return '';
    const ds = call('downstream', [id, {}], null);
    const main = ds && ds.draft ? draftPanel(id) : beforeCard(id, ds);
    return `<div class="lb-aside">${forcedCard(id, t)}${main}</div>`;
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     THE TEMPLATE PAGE  #/library/templates/:id  and its one editor (also in a sheet from the type pages)
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const PARAM_GUESS = { Level: 'tankHeight', 'Motor current': 'fullLoadCurrent' };
  function paramList() { const P = (V() && V().PARAMS) || {}; return Object.keys(P).map((k) => ({ key: k, label: P[k].label || k, unit: P[k].unit || '' })); }
  function ruleText(rule, unit) {
    if (!rule) return 'No band';
    const r = call('ruleText', [rule, unit], null); if (r) return r;
    if (rule.kind === 'const') return `${rule.value}${unit ? ' ' + unit : ''}`;
    const p = paramList().find((x) => x.key === rule.param); return `${pct(rule.factor)}% of ${(p ? p.label : rule.param).toLowerCase()}`;
  }
  const sizeDependent = (reading) => arr(V() && V().SIZE_DEPENDENT).includes(reading);
  /* what the editor shows for one rule: the form's entry, else the draft's rule, else the published one */
  function ruleState(fb, cur) {
    const mode = (fb && fb.mode) || (cur ? cur.kind : 'none');
    return {
      mode,
      value: fb && fb.value !== undefined ? fb.value : cur && cur.kind === 'const' ? String(cur.value) : '',
      factor: fb && fb.factor !== undefined ? fb.factor : cur && cur.kind === 'expr' ? String(pct(cur.factor)) : '',
      param: (fb && fb.param) || (cur && cur.kind === 'expr' ? cur.param : null),
    };
  }
  function formRule(fb, cur, guess) {
    if (!fb) return { rule: cur || null, changed: false };
    const s = ruleState(fb, cur);
    if (s.mode === 'none') return { rule: null, changed: true };
    if (s.mode === 'const') { if (!isNum(s.value)) return { error: 'Give the limit as a number.' }; return { rule: { kind: 'const', value: +s.value }, changed: true }; }
    if (!isNum(s.factor) || +s.factor <= 0) return { error: 'Give the share of the design parameter as a percentage above 0.' };
    return { rule: { kind: 'expr', factor: +s.factor / 100, param: s.param || guess || (paramList()[0] || {}).key }, changed: true };
  }
  const sameRule = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
  function idPart(id) { return String(id).replace(/[^a-zA-Z0-9_-]/g, '-'); }
  function ruleInputs(id, which, s, unit, o, label) {
    const pre = `${o.sheet ? 'sh' : 'ed'}-${idPart(id)}-${which}`; const sheet = o.sheet ? ' data-sheet="1"' : '';
    const da = (extra) => `data-id="${esc(id)}" ${which.indexOf('cond.') === 0 ? `data-which="${esc(which.slice(5))}"` : `data-band="${esc(which)}"`}${sheet}${extra || ''}`;
    const modes = [['none', 'No band'], ['const', 'Constant'], ['expr', '× design parameter']].filter((m) => !(o.noNone && m[0] === 'none'));
    const sel = `<select id="${pre}-m" aria-label="${esc(label)}: kind of limit rule" data-act="tpl:mode" ${da()}>${modes.map(([v, l]) => `<option value="${v}"${s.mode === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    let inp = '';
    if (s.mode === 'const') inp = `<input type="number" step="any" inputmode="decimal" id="${pre}-v" value="${esc(s.value)}" aria-label="${esc(label)}: limit" data-act="tpl:field" data-key="value" data-live ${da()}>${unit ? `<span class="tp-u">${esc(unit)}</span>` : ''}`;
    else if (s.mode === 'expr') {
      const ps = paramList(); const pv = s.param || o.guess || (ps[0] || {}).key;
      inp = `<input type="number" step="any" min="0" inputmode="decimal" id="${pre}-f" value="${esc(s.factor)}" aria-label="${esc(label)}: share" data-act="tpl:field" data-key="factor" data-live ${da()}><span class="tp-u">% of</span>`
        + `<select id="${pre}-p" aria-label="${esc(label)}: design parameter" data-act="tpl:param" ${da()}>${ps.map((p) => `<option value="${esc(p.key)}"${p.key === pv ? ' selected' : ''}>${esc(p.label.toLowerCase())}</option>`).join('')}</select>`;
    }
    return `<div class="tp-in">${sel}${inp}</div>`;
  }
  function editorHtml(id, opts) {
    const o = opts || {}; const t = call('template', [id], null); if (!t) return '';
    const F = edForm(id); const dv = t.draftView; const body = dv && dv.body ? dv.body : t.body || {}; const pub = t.body || {};
    const unit = t.unit || ''; const guess = PARAM_GUESS[t.reading] || PARAM_GUESS[t.condition && t.condition.reading] || null;
    const fTarget = String(o.f || '');
    const sheet = o.sheet ? ' data-sheet="1"' : ''; const pre = `${o.sheet ? 'sh' : 'ed'}-${idPart(id)}`;
    const parts = [];
    if (t.kind === 'trigger') {
      const rows = BANDS.map((b) => {
        const cur = (body.rules || {})[b] || null; const fb = F.bands[b]; const s = ruleState(fb, cur); const fr = formRule(fb, cur, guess);
        const shown = fr.error ? null : fr.rule; const was = (pub.rules || {})[b] || null;
        const flag = shown && shown.kind === 'const' && sizeDependent(t.reading) ? `<span class="tp-flag">${chip('This scales with the plant. Use a design parameter?', { tone: 'gap' })}</span>` : '';
        const moved = !sameRule(shown, was) ? `<span class="tp-was">${chip('In the draft', { tone: 'warn' })} was ${esc(ruleText(was, unit))}</span>` : '';
        return `<div class="tp-row${fTarget === `band.${b}` ? ' is-target' : ''}" data-f="band.${b}"><div class="tp-bn">${UI.sev ? UI.sev(b) : esc(BAND[b])} <span class="muted">${esc(t.dir === 'below' ? 'below' : 'above')}</span></div>`
          + ruleInputs(id, b, s, unit, Object.assign({}, o, { guess }), BAND[b])
          + `<div class="tp-rt"><span class="tp-rtx" data-rt="${b}">${esc(fr.error ? fr.error : ruleText(shown, unit))}</span>${flag}${moved}</div></div>`;
      }).join('');
      parts.push(card({ title: 'Limit rules', sub: `One limit rule per band: a constant, or a share of a design parameter that each plant resolves with its own value. Reads ${t.reading}, ${t.dirWord}.`, cls: 'tp-card', body: `<div class="tp-rows">${rows}</div>` }));
      const tm = (k, label, f) => {
        const v = F[k] !== undefined ? F[k] : body[k] != null ? String(body[k]) : '';
        const was = pub[k]; const moved = F[k] === undefined && body[k] !== pub[k] ? ` <span class="tp-was">${chip('In the draft', { tone: 'warn' })} was ${esc(was)} min</span>` : '';
        return `<div class="tp-row${fTarget === f ? ' is-target' : ''}" data-f="${f}"><label class="tp-tl" for="${pre}-${k}">${esc(label)}</label><div class="tp-in"><input type="number" min="0" step="1" inputmode="numeric" id="${pre}-${k}" value="${esc(v)}" data-act="tpl:field" data-id="${esc(id)}" data-key="${k}" data-live${sheet}><span class="tp-u">min</span></div><div class="tp-rt">${moved}</div></div>`;
      };
      parts.push(card({ title: 'Persistence and clearing', cls: 'tp-card', body: `<div class="tp-rows">${tm('hold', 'Persistence · must hold for', 'persistence')}${tm('clear', 'Clearing · must clear for', 'clearing')}</div><p class="small muted mt">Emergency band: fires on the first reading (fixed).</p>` }));
    } else {
      const ev = F.every || {}; const cur = body.every || null;
      const n = ev.n !== undefined ? ev.n : cur ? String(cur.n) : ''; const un = ev.unit || (cur ? cur.unit : 'month');
      const rowsT = [];
      if (cur || ev.n !== undefined) {
        rowsT.push(`<div class="tp-row${fTarget === 'cadence' ? ' is-target' : ''}" data-f="cadence"><label class="tp-tl" for="${pre}-en">Cadence · every</label><div class="tp-in"><input type="number" min="1" step="1" inputmode="numeric" id="${pre}-en" value="${esc(n)}" data-act="tpl:field" data-id="${esc(id)}" data-key="everyN" data-live${sheet}>`
          + `<select id="${pre}-eu" aria-label="Cadence unit" data-act="tpl:field" data-id="${esc(id)}" data-key="everyUnit"${sheet}>${UNITS.map((u) => `<option value="${u}"${u === un ? ' selected' : ''}>${u}${+n === 1 ? '' : 's'}</option>`).join('')}</select></div>`
          + `<div class="tp-rt">${!_sameEvery(body.every, pub.every) ? `<span class="tp-was">${chip('In the draft', { tone: 'warn' })} was ${esc(t.everyText || '')}</span>` : ''}</div></div>`);
      }
      if (body.meterHours != null) {
        const rh = F.runHours !== undefined ? F.runHours : String(body.meterHours);
        rowsT.push(`<div class="tp-row${fTarget === 'runhours' ? ' is-target' : ''}" data-f="runhours"><label class="tp-tl" for="${pre}-rh">Run-hours · every</label><div class="tp-in"><input type="number" min="1" step="1" inputmode="numeric" id="${pre}-rh" value="${esc(rh)}" data-act="tpl:field" data-id="${esc(id)}" data-key="runHours" data-live${sheet}><span class="tp-u">run-hours</span></div><div class="tp-rt"></div></div>`);
      }
      if (body.condition) {
        const cu = t.unit || '';
        ['doWhen', 'doneWhen'].forEach((k) => {
          const c0 = body.condition[k] || null; const fb = F.cond[k]; const s = ruleState(fb, c0); const fr = formRule(fb, c0, guess); const label = k === 'doWhen' ? 'Do when' : 'Done when';
          rowsT.push(`<div class="tp-row${fTarget === `condition.${k}` ? ' is-target' : ''}" data-f="condition.${k}"><div class="tp-bn">${esc(label)} <span class="muted">${esc(body.condition.reading || '')} ${esc(k === 'doWhen' ? (body.condition.op === 'below' ? 'falls below' : 'rises above') : (body.condition.op === 'below' ? 'rises above' : 'falls below'))}</span></div>`
            + ruleInputs(id, `cond.${k}`, s, cu, Object.assign({}, o, { guess, noNone: true }), label)
            + `<div class="tp-rt"><span class="tp-rtx" data-rt="cond.${k}">${esc(fr.error ? fr.error : ruleText(fr.rule, cu))}</span></div></div>`);
        });
      }
      parts.push(card({ title: body.condition ? 'Cadence and condition' : 'Cadence', sub: body.condition ? 'A condition Task comes due when its reading crosses the do-when threshold, and is done when it is back past done-when.' : `${workLabel(t.workType)}.`, cls: 'tp-card', body: `<div class="tp-rows">${rowsT.join('') || '<p class="muted">No cadence set.</p>'}</div>` }));
    }
    const foot = `<div class="tp-save">${btn('Save to the draft', { act: 'tpl:save', data: { id, sheet: o.sheet ? '1' : null }, kind: 'primary' })}<span class="small muted">Nothing reaches a plant until you publish. Downstream shows every plant it reaches first.</span></div>`;
    return `<div class="tp-ed">${parts.join('')}${o.sheet ? '' : foot}</div>`;
  }
  function _sameEvery(a, b) { return JSON.stringify(a ? { n: +a.n, unit: a.unit } : null) === JSON.stringify(b ? { n: +b.n, unit: b.unit } : null); }
  function editTemplateButton(id, o) {
    o = o || {}; if (!id) return '';
    return btn(o.label || 'Edit template', { act: 'tpl:sheet', data: { id, band: o.band || null, mode: o.mode || null }, small: true, kind: 'ghost', title: 'Opens the template editor. Saving makes a draft.' });
  }
  /* the plant's pin on a template: for the Trigger page and the template page */
  function pinButton(key, tplId) {
    const t = call('template', [tplId], null); if (!t || !key) return '';
    const p = arr(call('pins', [{ plant: key }], [])).find((x) => x && x.templateId === tplId);
    if (p) {
      const c = call('chipFor', [{ src: 'pinned', v: p.v }], null) || { text: `Pinned to v${p.v}`, tone: 'pin' };
      return `<span class="lb-pin">${chipHtml(c)} ${btn(`Unpin · follows v${t.v}`, { act: 'pin:unpin', data: { plant: key, tpl: tplId }, small: true, kind: 'ghost' })}</span>`;
    }
    const v0 = call('versionAt', [key, tplId], t.v);
    return btn(`Pin this plant to v${v0}`, { act: 'pin:open', data: { plant: key, tpl: tplId }, small: true, kind: 'ghost' });
  }
  function usesCard(t) {
    const uses = arr(t.uses); if (!uses.length) return card({ title: 'Where it is used', cls: 'tp-card', body: '<p class="muted">No plant uses it yet.</p>' });
    const triggers = {}; const chipOf = (p, aid) => { if (!triggers[p]) triggers[p] = arr(call('alerts', [p, {}], [])); const a = triggers[p].find((x) => x.id === aid); return a ? a.chipText : ''; };
    const byPlant = plants().map((p) => ({ p, xs: uses.filter((u) => u.plant === p.key) })).filter((g) => g.xs.length);
    const item = (u) => {
      if (u.kind === 'zone') return `<li><a href="#/p/${esc(enc(u.plant))}/sensor/${esc(enc(u.sensorId))}">${esc(u.tag)}</a> <span class="muted">Zones on ${esc(u.nodeTag || '')}${u.bound ? '' : ' · proposed in the bindings pass'}</span></li>`;
      if (u.kind === 'trigger') { const c = chipOf(u.plant, u.alertId); return `<li><a href="#/p/${esc(enc(u.plant))}/trigger/${esc(enc(u.alertId))}">${esc(u.name)}</a>${c ? ' ' + chip(c) : ''}</li>`; }
      if (u.kind === 'schedule') return `<li><a href="#/p/${esc(enc(u.plant))}/trigger/${esc(enc(u.scheduleId))}">${esc(u.name)}${u.tag ? ` on ${esc(u.tag)}` : ''}</a></li>`;
      return `<li><a href="#/p/${esc(enc(u.plant))}/trigger/${esc(enc(u.workId))}">${esc(u.name)}${u.tag ? ` on ${esc(u.tag)}` : ''}</a></li>`;
    };
    return card({ title: 'Where it is used', sub: `${plural(byPlant.length, 'plant')}`, cls: 'tp-card', body: byPlant.map((g) => `<div class="tp-use"><p class="lb-k"><a href="#/p/${esc(enc(g.p.key))}">${esc(g.p.name)}</a></p><ul>${g.xs.map(item).join('')}</ul></div>`).join('') });
  }
  function pinsCard(t) {
    const ps = arr(t.pins); if (!ps.length) return '';
    return card({ title: 'Pinned at plants', sub: 'A pin keeps a plant on its version through Patch, Minor and Major changes. A Forced change still reaches it.', cls: 'tp-card', body: `<ul class="lb-hist">${ps.map((p) => `<li><p><b>${esc(plantName(p.plant))}</b> · v${esc(p.v)} · ${esc(fmtDate(p.at))}</p><p class="small">${esc(p.reason || '')}${p.note ? ` · ${esc(p.note)}` : ''}</p><p>${pinButton(p.plant, t.id)}</p></li>`).join('')}</ul>` });
  }
  function historyList(t) {
    const h = arr(t.history).slice().reverse();
    return card({ title: 'Version history', cls: 'tp-card', body: h.length ? `<ul class="lb-hist">${h.map((x) => `<li><p>${esc(x.text)}</p></li>`).join('')}</ul>` : '<p class="muted">v1 · first version</p>' });
  }
  /* "Make it the library default" lands here with ?promote=: the draft opens with the override's value in its field */
  /* the library's rule with the plant's value in it: a constant stays a constant; a share of a design parameter keeps its
     parameter and takes the share that gives the plant's value there, so the rule still scales at every other plant */
  function promotedRule(cur, value, base) {
    if (value == null) return null;
    if (cur && cur.kind === 'expr' && isNum(base) && +base > 0 && isNum(cur.factor)) return { kind: 'expr', factor: Math.round((+cur.factor * +value / +base) * 10000) / 10000, param: cur.param };
    return { kind: 'const', value: +value };
  }
  function promoteChange(o) {
    const k = o.kind; const t = o.target || {}; const tb = o.templateId ? (call('template', [o.templateId], null) || {}).body || {} : {};
    if (k === 'zone' || k === 'triggerLimit' || k === 'limit') return t.band ? { band: t.band, rule: promotedRule((tb.rules || {})[t.band] || null, o.value, o.currentBase) } : null;
    if (k === 'persistence' || k === 'hold') return { hold: o.value };
    if (k === 'clearing' || k === 'clear') return { clear: o.value };
    if (k === 'cadence') return o.value && o.value.n ? { every: o.value } : null;
    if (k === 'runhours') return { runHours: o.value };
    if (k === 'condition') return t.which ? { condition: { [t.which]: promotedRule(((tb.condition || {})[t.which]) || null, o.value, o.currentBase) } } : null;
    return null;
  }
  function ensurePromote(id, ovId) {
    const o = call('overrideById', [ovId], null); if (!o) return { text: null };
    const t = call('template', [id], null);
    const active = !o.status || o.status === 'active';
    if (active && o.templateId === id && t && !(t.draftView && t.draftView.promoteFrom === ovId)) {
      const ch = promoteChange(o);
      if (ch) { const r = call('editTemplate', [id, ch, { promoteFrom: ovId }], null); if (!r || !r.ok) return { text: o.promoteBanner, error: (r && r.error) || 'The value could not be filled in.' }; }
    }
    return { text: active ? o.promoteBanner : `This override is ${String(o.stateLabel || o.status).toLowerCase()}: there is nothing to promote.` };
  }
  function ensureMerge(id) {
    const su = arr(call('singleUse', [{}], [])).find((x) => x && x.id === id); if (!su) return null;
    const t = call('template', [id], null);
    if (t && t.singleUse && !(t.draftView && t.draftView.merge)) call('editTemplate', [id, {}, { merge: true }], null);
    return su.mergeBanner || null;
  }
  function templatePage(params) {
    const id = params && params.id; const q = (params && params._q) || {};
    let t = call('template', [id], null);
    if (!t) return notFound('template', 'templates', '#/library/templates');
    const banners = [];
    if (q.promote) { const p = ensurePromote(id, q.promote); if (p.text) banners.push(bannerOf(p.text, { tone: 'info' })); if (p.error) banners.push(note(p.error, 'bad')); }
    if (q.merge) { const m = ensureMerge(id); if (m) banners.push(bannerOf(m, { tone: 'info' })); }
    t = call('template', [id], t);
    if (t.draftView && !q.promote && !q.merge) banners.push(note(`Draft v${t.draftView.nextVersion}: not published, so no plant sees it yet. Read Downstream, then publish or discard it.`, 'warn'));
    const flowNm = t.flowId ? flowName(t.flowId) : null;
    const flowLine = flowNm ? `<p class="tp-flow">Diagnostic flow: <a href="#/library/flows/${esc(enc(t.flowId))}">${esc(flowNm)} ↗</a></p>` : '';
    const lu = t.listedUnder || { text: `Listed under: ${t.ownerName}`, href: ownerHref(t.owner) };
    const chips = [
      chip(t.chipText, { tone: 'lib' }), chip(`Outcome: ${t.outcome}`), chip(`Subject: ${t.subjectLabel} (${t.ownerName})`),
      t.kind === 'trigger' ? chip(`Reads: ${t.reading}, ${t.dirWord}`) : '',
      chip(`${lu.text} ↗`, { href: lu.href }),
      t.singleUse ? chip(`Single-use · ${plantName(t.singleUse.plant)}`, { tone: 'single' }) : '',
      t.draftView ? chip(`Draft v${t.draftView.nextVersion}`, { tone: 'warn' }) : '',
    ];
    const ol = ownerList(t.owner);
    const body = editorHtml(id, { f: q.f }) + flowLine + usesCard(t) + pinsCard(t) + historyList(t);
    return page({
      crumbs: [{ label: 'Library', href: '#/library' }, ol, { label: t.ownerName, href: ownerHref(t.owner) }, { label: t.name }],
      title: t.name, chips, sub: 'Editing makes a draft. Downstream shows every plant it reaches before you publish.',
      banner: banners.join(''), body, aside: templateAside(id), cls: 'pg-lib pg-tpl',
    });
  }

  /* #/library/:code/:tab? — older links: the equipment type for a known code, else the library home */
  function aliasPage(params) {
    const code = params && params.code;
    if (code && call('libType', [code], null)) return eqTypePage({ code, tab: params.tab, _q: params._q || {}, _path: params._path });
    return homePage(params);
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     ACTIONS
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const closeBtn = (label, what) => btn(label || 'Cancel', { act: 'ui:close', data: { what: what || 'modal' }, kind: 'ghost' });
  const inSheet = (el) => attr(el, 'data-sheet') === '1';
  function refreshEditorSheet(id) { if (typeof UI.refreshSheet === 'function') UI.refreshSheet({ body: editorHtml(id, { sheet: true }) }); }
  function liveRuleText(el, id, which) {
    try {
      const row = el && el.closest ? el.closest('.tp-row') : null; const span = row && row.querySelector ? row.querySelector('.tp-rtx') : null; if (!span) return;
      const t = call('template', [id], null); if (!t) return;
      const F = edForm(id); const body = t.draftView && t.draftView.body ? t.draftView.body : t.body || {};
      const cond = which.indexOf('cond.') === 0; const k = cond ? which.slice(5) : which;
      const cur = cond ? ((body.condition || {})[k] || null) : ((body.rules || {})[k] || null);
      const fr = formRule(cond ? F.cond[k] : F.bands[k], cur, PARAM_GUESS[t.reading] || null);
      span.textContent = fr.error ? fr.error : ruleText(fr.rule, t.unit || '');
    } catch (e) { /* the text refreshes on the next render */ }
  }
  const whichOf = (el) => (attr(el, 'data-which') ? `cond.${attr(el, 'data-which')}` : attr(el, 'data-band'));
  function entryFor(id, which) { const F = edForm(id); if (which.indexOf('cond.') === 0) { const k = which.slice(5); return F.cond[k] || (F.cond[k] = {}); } return F.bands[which] || (F.bands[which] = {}); }

  UI.on('lib:q', (el) => { const s = attr(el, 'data-scope') || 'home'; ST.q[s] = String((el && el.value) || ''); });
  UI.on('lib:q-clear', (el) => { const s = attr(el, 'data-scope') || 'home'; ST.q[s] = ''; });
  UI.on('lib:owner', (el) => { const kind = attr(el, 'data-kind'); UI.go('#/library/templates' + qs({ kind, owner: String((el && el.value) || '') })); return undefined; });

  UI.on('tpl:mode', (el) => {
    const id = attr(el, 'data-id'); const which = whichOf(el); if (!id || !which) return false;
    const e = entryFor(id, which); e.mode = String((el && el.value) || 'none');
    if (inSheet(el)) { refreshEditorSheet(id); return false; }
    return undefined;
  });
  UI.on('tpl:param', (el) => { const id = attr(el, 'data-id'); const which = whichOf(el); if (!id || !which) return false; entryFor(id, which).param = String((el && el.value) || ''); liveRuleText(el, id, which); return false; });
  UI.on('tpl:field', (el) => {
    const id = attr(el, 'data-id'); if (!id) return false; const key = attr(el, 'data-key'); const val = String(el && el.value != null ? el.value : '');
    const which = whichOf(el);
    if (which) { entryFor(id, which)[key] = val; liveRuleText(el, id, which); return false; }
    const F = edForm(id);
    if (key === 'everyN') F.every = Object.assign({}, F.every, { n: val });
    else if (key === 'everyUnit') F.every = Object.assign({}, F.every, { unit: val });
    else if (key) F[key] = val;
    return false;
  });
  UI.on('tpl:sheet', (el) => {
    const id = attr(el, 'data-id'); const t = call('template', [id], null); if (!t) { UI.toast('There is no such template in the library.'); return false; }
    const band = attr(el, 'data-band'); const mode = attr(el, 'data-mode');
    if (band && mode) { const e = entryFor(id, band); e.mode = mode; if (mode === 'expr' && !e.param) e.param = PARAM_GUESS[t.reading] || null; }
    UI.openSheet({
      title: `${t.name} · ${t.chipText}`, sub: `Listed under ${t.ownerName}. Saving makes a draft; nothing reaches a plant until you publish it.`, wide: true,
      body: editorHtml(id, { sheet: true }),
      foot: closeBtn('Cancel', 'sheet') + btn('Save to the draft', { act: 'tpl:save', data: { id, sheet: '1' }, kind: 'primary' }),
    });
    return false;
  });
  /* save every band, timing, cadence and condition typed so far into the template's draft (a second pass catches a band order
     that only holds once a neighbouring band has moved too) */
  UI.on('tpl:save', (el) => {
    const id = attr(el, 'data-id'); const t = call('template', [id], null); if (!t) return false;
    const F = edForm(id); const body = t.draftView && t.draftView.body ? t.draftView.body : t.body || {};
    const guess = PARAM_GUESS[t.reading] || PARAM_GUESS[t.condition && t.condition.reading] || null;
    const changes = [];
    for (const b of Object.keys(F.bands)) {
      const cur = (body.rules || {})[b] || null; const fr = formRule(F.bands[b], cur, guess);
      if (fr.error) { UI.toast(`${BAND[b]}: ${fr.error}`); return false; }
      if (!sameRule(fr.rule, cur)) changes.push({ band: b, rule: fr.rule });
    }
    ['hold', 'clear'].forEach((k) => { if (F[k] !== undefined && String(F[k]) !== String(body[k])) changes.push({ [k]: F[k] === '' ? NaN : +F[k] }); });
    if (F.every && (F.every.n !== undefined || F.every.unit)) {
      const cur = body.every || {}; const ev = { n: F.every.n !== undefined ? +F.every.n : +cur.n, unit: F.every.unit || cur.unit };
      if (!_sameEvery(ev, body.every)) changes.push({ every: ev });
    }
    if (F.runHours !== undefined && String(F.runHours) !== String(body.meterHours)) changes.push({ runHours: +F.runHours });
    for (const k of Object.keys(F.cond)) {
      const cur = ((body.condition || {})[k]) || null; const fr = formRule(F.cond[k], cur, guess);
      if (fr.error) { UI.toast(`${k === 'doWhen' ? 'Do when' : 'Done when'}: ${fr.error}`); return false; }
      if (!sameRule(fr.rule, cur)) changes.push({ condition: { [k]: fr.rule } });
    }
    if (!changes.length) { UI.toast('Nothing changed yet: type a new value first.'); return false; }
    let todo = changes; let lastErr = null;
    for (let pass = 0; pass < 2 && todo.length; pass++) {
      const failed = [];
      todo.forEach((c) => { const r = call('editTemplate', [id, c], null); if (!r || !r.ok) { failed.push(c); lastErr = (r && r.error) || 'That did not work.'; } });
      todo = failed;
    }
    delete ST.ed[id];
    if (todo.length) { UI.toast(lastErr); return undefined; }
    const dv = call('templateDraft', [id], null);
    if (inSheet(el) && typeof UI.closeSheet === 'function') UI.closeSheet(true);
    UI.toast(dv ? `Saved to the draft of ${t.name} v${dv.nextVersion}. Downstream shows every plant it reaches before you publish.` : `${t.name} is back to v${t.v}: the draft is gone.`, { ms: 7000 });
    return undefined;
  });

  UI.on('tpl:pubkind', (el) => { const id = attr(el, 'data-id'); if (!id) return false; pubForm(id).kind = String((el && el.value) || ''); return undefined; });
  UI.on('tpl:countfrom', (el) => { const id = attr(el, 'data-id'); if (!id) return false; pubForm(id).countFrom = String((el && el.value) || 'service'); return undefined; });
  UI.on('tpl:pubfield', (el) => {
    const name = attr(el, 'data-name') || 'note'; const val = String(el && el.value != null ? el.value : '');
    const tier = attr(el, 'data-tier'); if (tier) { (ST.typepub[tier] || (ST.typepub[tier] = {}))[name] = val; return false; }
    const id = attr(el, 'data-id'); if (!id) return false; pubForm(id)[name] = val; return false;
  });
  UI.on('tpl:publish', (el) => {
    const id = attr(el, 'data-id'); const t = call('template', [id], null); if (!t) return false;
    const { ds, F } = currentDs(id);
    if (!ds || !ds.draft) { UI.toast('There is no draft to publish.'); return undefined; }
    const kind = F.kind || ds.suggestedKind;
    const r = call('publishTemplate', [id, { kind, note: String(F.note || '').trim(), reason: String(F.reason || '').trim(), countFrom: F.countFrom || (ds.dueNow ? 'service' : undefined) }], null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'Publishing did not work.'); return false; }
    delete ST.pub[id]; delete ST.ed[id];
    UI.toast(r.toast || `Published ${t.name} v${r.v}.`, { ms: 8000 });
    const cur = UI.current ? UI.current() : null;
    if (cur && /[?&](promote|merge)=/.test('?' + (cur.query || ''))) { UI.go(`#/library/templates/${enc(id)}`); return undefined; }
    return undefined;
  });
  UI.on('tpl:discard', (el) => {
    const id = attr(el, 'data-id'); const t = call('template', [id], null); if (!t) return false;
    const ds = call('downstream', [id, {}], null);
    UI.confirm({
      title: 'Discard the draft?', body: (ds && ds.discardText) || `Discard the draft of ${t.name}? Nothing has reached any plant.`, ok: 'Discard draft', kind: 'danger',
      onOk: () => {
        const r = call('discardTemplateDraft', [id], null); delete ST.pub[id]; delete ST.ed[id];
        if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not work.'); return undefined; }
        UI.toast(`Draft discarded. ${t.name} stays at v${t.v}; no plant saw it.`);
        const cur = UI.current ? UI.current() : null;
        if (cur && /^library\/templates\//.test(cur.path || '') && /(^|&)(promote|merge)=/.test(cur.query || '')) { UI.go(`#/library/templates/${enc(id)}`); return undefined; }
        return undefined;
      },
    });
    return false;
  });
  UI.on('tpl:lift', (el) => {
    const id = attr(el, 'data-id'); const t = call('template', [id], null); if (!t) return false;
    ST.lift = { id, reason: '' };
    UI.modal({
      title: `Lift the Forced change on ${t.name}?`, sub: 'Suspended overrides apply again at every plant.',
      body: field({ label: 'Reason', hint: 'Required. It goes into the All Plants Activity.', html: `<textarea id="lift-${esc(idPart(id))}" rows="3" data-act="tpl:lift-field" data-live></textarea>` }),
      foot: closeBtn() + btn('Lift it', { act: 'tpl:lift-save', data: { id }, kind: 'primary' }),
    });
    return false;
  });
  UI.on('tpl:lift-field', (el) => { if (ST.lift) ST.lift.reason = String((el && el.value) || ''); return false; });
  UI.on('tpl:lift-save', (el) => {
    const id = attr(el, 'data-id') || (ST.lift && ST.lift.id); const reason = String((ST.lift && ST.lift.reason) || '').trim();
    if (!reason) { UI.toast('Say why the Forced change is lifted.'); return false; }
    const r = call('liftForced', [id, { reason }], null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not work.'); return false; }
    ST.lift = null; UI.closeModal(true);
    UI.toast(`Forced change lifted: ${plural(arr(r.lifted).length, 'suspended override')} apply again.`);
    return undefined;
  });
  UI.on('tpl:typepub', (el) => {
    const typeKey = attr(el, 'data-type'); const ovId = attr(el, 'data-ov'); const o = call('overrideById', [ovId], null);
    if (!typeKey || !o) { UI.toast('That override is no longer there.'); return undefined; }
    const F = ST.typepub[ovId] || {}; const noteText = String(F.note || '').trim();
    if (!noteText) { UI.toast('Write a change note.'); return false; }
    const r1 = call('editTypeField', [typeKey, { defaultTier: o.value, promoteFrom: ovId }], null);
    if (!r1 || !r1.ok) { UI.toast((r1 && r1.error) || 'That did not work.'); return false; }
    const r2 = call('publishTypeField', [typeKey, { note: noteText }], null);
    if (!r2 || !r2.ok) { UI.toast((r2 && r2.error) || 'Publishing did not work.'); return false; }
    delete ST.typepub[ovId];
    const parts = typeKey.split(':'); const owner = parts[0] === 'up' ? { kind: 'upType', id: parts[1] } : { kind: 'eqType', code: parts[1] };
    UI.toast(`Published ${ownerName(owner)} v${r2.v} (Minor): default criticality tier → ${o.valueText || o.value}.`, { ms: 8000 });
    UI.go(ownerHref(owner));
    return undefined;
  });

  /* pins */
  UI.on('pin:open', (el) => {
    const key = attr(el, 'data-plant'); const id = attr(el, 'data-tpl'); const t = call('template', [id], null);
    if (!t || !key) { UI.toast('There is no such template in the library.'); return false; }
    const v0 = call('versionAt', [key, id], t.v);
    ST.pin = { key, id, reason: '', note: '' };
    UI.modal({
      title: `Why should this plant stay on v${v0}?`, sub: `${t.name} at ${plantName(key)}`,
      body: `<p>A pin keeps ${esc(plantName(key))} on ${esc(t.name)} v${esc(v0)} through Patch, Minor and Major changes. A Forced change still reaches it.</p>`
        + field({ label: 'Reason', hint: 'Required.', html: `<textarea id="pin-reason" rows="3" placeholder="Why this plant stays on this version" data-act="pin:field" data-name="reason" data-live></textarea>` })
        + field({ label: 'Note', html: `<textarea id="pin-note" rows="2" data-act="pin:field" data-name="note" data-live></textarea>` }),
      foot: closeBtn() + btn(`Pin to v${v0}`, { act: 'pin:save', kind: 'primary' }),
    });
    return false;
  });
  UI.on('pin:field', (el) => { if (ST.pin) ST.pin[attr(el, 'data-name') || 'reason'] = String((el && el.value) || ''); return false; });
  UI.on('pin:save', () => {
    const P = ST.pin; if (!P) return false;
    const r = call('pin', [P.key, P.id, { reason: String(P.reason || '').trim(), note: String(P.note || '').trim() }], null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not work.'); return false; }
    ST.pin = null; UI.closeModal(true);
    UI.toast(r.toast || 'Pinned.');
    return undefined;
  });
  UI.on('pin:unpin', (el) => {
    const key = attr(el, 'data-plant'); const id = attr(el, 'data-tpl'); const t = call('template', [id], null); if (!t || !key) return false;
    UI.confirm({
      title: `Unpin ${t.name} at ${plantName(key)}?`, body: `${plantName(key)} follows v${t.v} at once. Values that come from this template change to v${t.v}'s, except where the plant has its own override.`, ok: 'Unpin',
      onOk: () => { const r = call('unpin', [key, id], null); if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not work.'); return undefined; } UI.toast(r.toast || 'Unpinned.'); return undefined; },
    });
    return false;
  });

  /* a field named in ?f= is marked is-target; bring it into view once per address */
  let lastTarget = '';
  if (typeof UI.afterRender === 'function') UI.afterRender((main, path) => {
    try {
      if (String(path || '').indexOf('library/') !== 0) { lastTarget = ''; return; }
      const key = String((W.location && W.location.hash) || ''); if (key === lastTarget) return;
      const el = main && main.querySelector ? main.querySelector('.is-target') : null; lastTarget = key;
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    } catch (e) { /* scrolling is a nicety */ }
  });

  /* ── routes ──────────────────────────────────────────────────────────────────────────────────────────────── */
  UI.route('library', homePage);
  UI.route('library/eq-types', eqTypesPage);
  UI.route('library/eq-types/:code/:tab?', eqTypePage);
  UI.route('library/up-types', upTypesPage);
  UI.route('library/up-types/:id/:tab?', upTypePage);
  UI.route('library/templates', templatesPage);
  UI.route('library/templates/:id', templatePage);
  UI.route('library/plant-types', plantTypesPage);
  UI.route('library/plant-types/:id/:tab?', plantTypePage);
  UI.route('library/conditions/:id?', conditionsPage);
  UI.route('library/flows/:id?', flowsPage);
  UI.route('library/root-causes/:id?', causesPage);
  UI.route('library/:code/:tab?', aliasPage);

  W.V7LIB = {
    downstreamAside, templateAside, editorHtml, editTemplateButton, pinButton, typeBanner, chipHtml,
    homePage, eqTypesPage, upTypesPage, templatesPage, plantTypesPage, conditionsPage, flowsPage, causesPage, eqTypePage, upTypePage, plantTypePage, templatePage,
    _state: ST, _typeFallback: typeFallback,
  };
}());
