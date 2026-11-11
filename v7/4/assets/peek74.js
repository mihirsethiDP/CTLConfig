/* v7/4 · peek74.js — progressive disclosure, two parts.
   1. The side panel. A click on a piece of equipment or a library type, anywhere in a list, opens it in a panel on the right
      instead of leaving the page: what it is, its readings and limits, what the library proposes for it (decided there), its
      alerts and tasks. Click another row and the panel swaps. "Open the full page" is always in the panel.
      Not caught: a Ctrl/Cmd/Shift click, breadcrumbs, tabs, buttons, and "Open X →" links: those still go to the page.
   2. window.V7KEEP: a folded section (<details data-keep="id">) remembers whether the person opened it, so a decision made
      inside it does not fold it shut again when the page redraws.
   Exposes window.V7PEEK { open, close, isOpen, html } and window.V7KEEP { open(id, byDefault) → ' open' | '' }. */
(function () {
  'use strict';
  const W = window; const UI = W.V7UI; if (!UI) return;
  const V = () => W.V7; const { esc, chip, btn, note, plural } = UI;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = encodeURIComponent;
  const safe = (fn, fb) => { try { const r = fn(); return r == null ? fb : r; } catch (e) { return fb; } };

  /* ── 2. folded sections that stay as the person left them ── */
  const KEPT = {};
  W.V7KEEP = { open: (id, byDefault) => ((id in KEPT ? KEPT[id] : !!byDefault) ? ' open' : ''), set: (id, on) => { KEPT[id] = !!on; }, clear: () => { Object.keys(KEPT).forEach((k) => delete KEPT[k]); } };
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('toggle', (ev) => { const d = ev.target; const id = d && d.getAttribute ? d.getAttribute('data-keep') : null; if (id) KEPT[id] = !!d.open; }, true);

  /* ── 1. the side panel ── */
  const RE_EQ = /^#\/p\/([^/?#]+)\/eq\/([^/?#]+)$/; const RE_TYPE = /^#\/library\/([^/?#]+)$/;
  const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const target = (href) => { let m = RE_EQ.exec(href || ''); if (m) return { kind: 'eq', key: dec(m[1]), id: dec(m[2]), href }; m = RE_TYPE.exec(href || ''); return m ? { kind: 'type', code: dec(m[1]), href } : null; };
  const eqHref = (key, id, tab) => `#/p/${enc(key)}/eq/${enc(id)}${tab ? '/' + tab : ''}`;
  const libHref = (code, tab) => `#/library/${enc(code)}${tab ? '/' + tab : ''}`;
  const sec = (title, body, right) => `<section class="pk-sec"><header class="pk-sec-h"><h3>${esc(title)}</h3>${right ? `<span class="pk-sec-r">${right}</span>` : ''}</header>${body}</section>`;
  const more = (n, noun, href) => (n > 0 ? `<p class="pk-more"><a class="pk-full" href="${esc(href)}">and ${n} more ${noun}${n === 1 ? '' : 's'} on the full page</a></p>` : '');
  const rows = (items) => `<ul class="pk-rows">${items.map((x) => `<li class="pk-row${x.cls ? ' ' + x.cls : ''}"><div class="pk-row-m"><div class="pk-row-t">${x.title}</div>${x.sub ? `<div class="pk-row-s">${x.sub}</div>` : ''}</div>${x.right ? `<div class="pk-row-r">${x.right}</div>` : ''}</li>`).join('')}</ul>`;

  function limitsOfReading(key, r) {
    const v = V();
    if (r.nextPhase) return { text: 'On a connection between equipment', chip: chip('Next phase', { tone: 'next' }) };
    if (!r.takesLimits) return { text: 'A counter: no limits', chip: '' };
    const dirs = arr(r.dirs); if (!dirs.length) return { text: r.kind === 'status' ? 'ON or OFF: no limits needed' : 'No limits', chip: '' };
    const texts = dirs.map((dir) => { const L = safe(() => v.limitsOf(key, r.id, dir), null); const has = L && UI.BANDS.some((b) => L.bands && L.bands[b] != null); return has ? v.limitsText(L.bands, dir, L.unit || r.unit, L.kind || r.kind) : ''; }).filter(Boolean);
    const none = safe(() => v.noLimitsYet(key, r), !texts.length);
    return { text: texts.join(' · ') || (r.kind === 'status' ? 'ON or OFF: no limits needed' : ''), chip: none ? chip('No limits yet', { tone: 'none' }) : '' };
  }

  function eqPanel(key, id) {
    const v = V(); const e = safe(() => v.eq(key, id), null); if (!e) return null;
    const P = safe(() => v.plant(key), {}); const setup = P.state === 'commissioning'; const ST = W.V7STRUCT73;
    const chips = [e.dbType ? `<a href="${esc(libHref(e.dbType))}">${chip(e.typeName, { tone: 'lib', title: 'Its library type: click to look at it here' })}</a>` : chip(e.typeName || '')].concat(ST ? ST.chips(key, id) : []);
    const parts = [`<div class="pk-chips">${chips.join(' ')}</div>`];
    if (e.notInDb) parts.push(note('Its type is not one of the database types, so the library brings nothing for it.', 'bad'));

    /* what the library proposes for it: decided here */
    const row = arr(safe(() => v.libraryReview(key), [])).find((r) => r.eqId === id); const props = arr(row && row.proposals);
    const shared = (p) => p.kind === 'task' && ['routine', 'work', 'test'].includes(p.workType);
    const und = props.filter((p) => !p.decided && !p.blockedBy); const own = und.filter((p) => !shared(p)); const sh = und.filter(shared);
    const blocked = props.filter((p) => p.blockedBy); const acc = props.filter((p) => p.decided === 'accepted').length; const rej = props.filter((p) => p.decided === 'rejected').length;
    if (props.length) {
      const d = (p) => ({ plant: key, pid: p.pid });
      const list = own.slice(0, 8).map((p) => ({ title: `${p.kind === 'alert' ? chip('Alert', { tone: 'info' }) : chip('Task', { tone: 'muted' })} ${esc(p.name)}`, sub: esc(p.detail || ''),
        right: btn('Accept', { act: 'p7:lib-accept', data: d(p), small: true, title: p.kind === 'alert' ? 'It goes On trial: trial firings are recorded, nothing is sent' : 'It starts at go live' }) + btn('Not here', { act: 'p7:lib-reject', data: d(p), small: true, kind: 'ghost', title: 'Not for this plant: asks for a reason' }) }));
      const tail = [acc ? `${acc} accepted` : '', rej ? `${rej} not for this plant` : '', sh.length ? `${sh.length} more shared by every ${esc(e.typeName)}, decided once on the Library tab` : '', blocked.length ? `${blocked.length} can’t be used yet: the plant graph sends no such reading` : ''].filter(Boolean);
      const body = (list.length ? rows(list) + more(own.length - 8, 'proposal', `#/p/${enc(key)}/library?show=undecided&eq=${enc(id)}`) : `<p class="pk-quiet">${und.length ? 'Nothing to decide on this piece of equipment alone.' : 'Everything is decided.'}</p>`) + (tail.length ? `<p class="pk-tail">${tail.join(' · ')}</p>` : '');
      parts.push(sec(own.length ? `From the library · ${own.length} to decide` : 'From the library', body, und.length > 1 ? btn(`Accept all ${und.length}`, { act: 'p7:lib-accept-eq', data: { plant: key, eq: id }, small: true, kind: 'primary', title: 'Everything undecided for it, the tasks shared by its type included' }) : ''));
    }

    /* placing it in the structure */
    if (ST && arr(safe(() => ST.unplaced(key), [])).includes(id)) {
      const ups = arr(safe(() => v.structure(key).ups, []));
      if (ups.length) parts.push(sec('Not placed in a unit process yet', `<select class="pk-place" data-act="st:place" data-plant="${esc(key)}" data-eq="${esc(id)}" aria-label="Place ${esc(e.tag)}"><option value="">Place in…</option>${ups.map((u) => `<option value="${esc(u.id)}">${esc(u.tag)} · ${esc(u.typeName)}</option>`).join('')}<option value="__plant">Leave on the plant</option></select>`));
    }

    /* readings: the ones that need something first */
    const rs = arr(safe(() => v.readings(key, { eqId: id }), []));
    if (rs.length) {
      const items = rs.map((r) => { const L = limitsOfReading(key, r); const now = r.latest ? `<span class="mono">${esc(v.fmtVal ? v.fmtVal(r.latest.v, r.unit, r.kind) : r.latest.v)}</span>` : ''; return { need: !!L.chip && !r.nextPhase, title: `${esc(r.name)} ${L.chip}`, sub: esc(L.text), right: now, cls: r.nextPhase ? 'pk-dim' : '' }; });
      const need = items.filter((x) => x.need); const rest = items.filter((x) => !x.need);
      const fold = need.length && rest.length ? `<details class="pk-fold"><summary>${plural(rest.length, 'more reading')} with nothing to set</summary>${rows(rest)}</details>` : rows(rest);
      parts.push(sec(`Readings · ${rs.length}${need.length ? ` · ${need.length} with no limits yet` : ''}`, (need.length ? rows(need) : '') + fold, need.length ? `<a class="btn btn-ghost btn-sm pk-full" href="${esc(eqHref(key, id, 'readings'))}">Set limits</a>` : ''));
    } else parts.push(sec('Readings', '<p class="pk-quiet">The plant graph sends no readings for it.</p>'));

    /* alerts and tasks already on it */
    const als = arr(safe(() => v.alerts(key, { eqId: id }), [])).filter((a) => !a.nextPhase);
    if (als.length) parts.push(sec(`Alerts · ${als.length}`, rows(als.slice(0, 6).map((a) => ({ title: `<a class="pk-full" href="#/p/${enc(key)}/alert/${enc(a.id)}">${esc(String(a.name).replace(/\s+—\s+.*$/, ''))}</a>`, sub: esc(safe(() => v.limitsText(a.bands, a.dir, a.unit, a.kind), '')), right: UI.stateChip(a.state) }))) + more(als.length - 6, 'alert', eqHref(key, id, 'issues'))));
    const ts = arr(safe(() => v.tasks(key, { eqId: id }), []));
    if (ts.length) parts.push(sec(`Tasks · ${ts.length}`, rows(ts.slice(0, 5).map((t) => ({ title: esc(t.name || ''), sub: esc(t.everyText || t.whenText || '') }))) + more(ts.length - 5, 'task', eqHref(key, id, 'tasks'))));
    if (!props.length && !als.length && !ts.length && setup) parts.push(`<p class="pk-quiet">The library proposes nothing for it.</p>`);
    return { title: `<span class="mono">${esc(e.tag)}</span> ${esc(e.name || '')}`, sub: `${P.name || ''}${setup ? ' · being set up' : ''}`, body: parts.join(''), foot: `<a class="btn btn-primary pk-full" href="${esc(eqHref(key, id))}">Open the full page</a>` };
  }

  function typePanel(code) {
    const v = V(); const t = safe(() => v.libType(code), null); if (!t) return null;
    const N = W.V7NODES; const ab = N ? safe(() => N.about(code), null) : null;
    const chips = [chip(t.library === 'process' ? 'Unit process' : 'Equipment', { tone: t.library === 'process' ? 'info' : 'muted' }), chip(code, { mono: true }), chip(`Version ${t.version}`, { tone: 'lib' }), t.draft ? chip('Draft open', { tone: 'warn' }) : ''].filter(Boolean);
    const parts = [`<div class="pk-chips">${chips.join(' ')}</div>`];
    if (ab && ab.library === 'process') parts.push(`<p class="pk-lead">One treatment step. A tank or reactor gets it when other equipment takes part in it; on its own it gets <a href="${esc(libHref(ab.node.code))}">${esc(ab.node.name)}</a>.</p>`);
    else if (ab && arr(ab.processes).length) parts.push(`<p class="pk-lead">On its own it gets this type. With other equipment taking part in it, it gets ${ab.processes.map((p) => `<a href="${esc(libHref(p.key))}">${esc(p.name)}</a>`).join(' or ')}.</p>`);
    const used = arr(t.plants);
    parts.push(`<p class="pk-tail">${used.length ? `Used at ${esc(used.map((p) => `${p.name} (${p.count})`).join(', '))}` : 'Not used at any plant yet'}</p>`);
    const rd = arr(t.readings);
    parts.push(sec(`Readings · ${rd.length}`, rd.length ? rows(rd.map((r) => ({ title: esc(r.name), sub: esc(arr(r.dirs).map((d) => { const has = UI.BANDS.some((b) => d.bands && d.bands[b] != null); return has ? v.limitsText(d.bands, d.dir, r.unit, r.kind) : ''; }).filter(Boolean).join(' · ') || (r.kind === 'status' ? 'ON or OFF' : r.kind === 'meter' ? 'A counter: no limits' : 'No limits in the library')) }))) : '<p class="pk-quiet">No readings on the equipment itself.</p>'));
    const al = arr(t.alerts).filter((a) => !a.nextPhase);
    if (al.length) parts.push(sec(`Alerts · ${al.length}`, rows(al.slice(0, 6).map((a) => ({ title: esc(a.name), sub: esc(`${a.reading} ${a.dir === 'below' ? 'falls below' : 'rises above'} its limits`) }))) + more(al.length - 6, 'alert', libHref(code, 'readings'))));
    const sc = arr(t.schedules);
    if (sc.length) parts.push(sec(`Tasks · ${sc.length}`, rows(sc.slice(0, 6).map((s) => ({ title: esc(s.name), sub: esc(`${s.workLabel || ''}${s.everyText ? ' · ' + s.everyText : ''}`) }))) + more(sc.length - 6, 'task', libHref(code, 'tasks'))));
    const np = t.nextPhase || {}; const nNext = arr(np.readings).length + arr(np.alerts).length;
    if (nNext) parts.push(`<p class="pk-tail">${chip('Next phase', { tone: 'next' })} ${plural(nNext, 'item')} that read a connection between equipment.</p>`);
    if (t.confirm) parts.push(note(`To confirm: ${t.confirm}`, 'warn'));
    return { title: esc(t.typeName), sub: `Library · ${t.family || ''}`, body: parts.join(''), foot: `<a class="btn btn-primary pk-full" href="${esc(libHref(code))}">Open the full page</a>` };
  }

  let PEEK = null;
  const build = (t) => (t.kind === 'eq' ? eqPanel(t.key, t.id) : typePanel(t.code));
  const pathNow = () => String(W.location.hash || '').split('?')[0];
  function mark() { if (typeof document === 'undefined') return; document.querySelectorAll('.pk-on').forEach((x) => x.classList.remove('pk-on')); if (!PEEK) return; document.querySelectorAll('#main a[href]').forEach((a) => { if (a.getAttribute('href') === PEEK.t.href) { const row = a.closest('tr, li, summary, article') || a; row.classList.add('pk-on'); } }); }
  function close() { if (PEEK && UI.sheetEl() === PEEK.el) UI.closeSheet(); }
  function open(t) {
    const o = build(t); if (!o) return false;
    const same = PEEK && UI.sheetEl() === PEEK.el;
    if (same) { PEEK.t = t; UI.refreshSheet(o); const b = PEEK.el.querySelector('.sheet-b'); if (b) b.scrollTop = 0; mark(); return true; }
    const el = UI.openSheet({ ...o, onClose: () => { PEEK = null; document.body.classList.remove('has-peek'); mark(); } });
    if (!el) return false;
    el.classList.add('pk'); el.setAttribute('aria-modal', 'false');
    const scrim = document.querySelector('.scrim'); if (scrim) scrim.classList.add('pk-scrim');
    document.body.classList.add('has-peek'); PEEK = { t, el, path: pathNow() }; mark(); return true;
  }
  /* a decision made in the panel, or on the page behind it, redraws both; going to another page closes it */
  UI.afterRender(() => {
    if (!PEEK) return; if (UI.sheetEl() !== PEEK.el) { PEEK = null; document.body.classList.remove('has-peek'); return; }
    if (pathNow() !== PEEK.path) { close(); return; }
    const o = build(PEEK.t); if (!o) { close(); return; }
    UI.refreshSheet(o); mark();
  });
  function onClick(ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if ((W.innerWidth || 1280) < 760) return;                       /* a phone has no room for a panel: go to the page */
    const el = ev.target && ev.target.closest ? ev.target : null; if (!el) return;
    if (el.closest('.modal-wrap, .tb, .story, .crumbs, .tabs, .ph')) return;
    const a = el.closest('a[href]'); let href = null;
    if (a) { if (a.classList.contains('btn') || a.classList.contains('pk-full') || a.closest('.p7-more')) return; href = a.getAttribute('href'); }
    else { const row = el.closest('[data-href]'); if (!row || el.closest('button,input,select,textarea,label,summary,[data-act]')) return; href = row.getAttribute('data-href'); }
    const t = target(href); if (!t) return;
    if (pathNow() === href) return;
    if (open(t)) { ev.preventDefault(); ev.stopPropagation(); }
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', onClick, true);

  W.V7PEEK = { open: (href) => { const t = target(href); return t ? open(t) : false; }, close, isOpen: () => !!PEEK, html: (href) => { const t = target(href); return t ? build(t) : null; }, target };
}());
