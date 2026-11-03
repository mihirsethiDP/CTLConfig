/* v7/2 · plant7.js · window.V7PLANT — the plant pages of v7/2 (Alex's model as drafted).

   Loads after the core files (window.V7) and ui7.js (window.V7UI). Pure string renderers registered with V7UI.route; every
   action is a data-act handler registered with V7UI.on (the shell persists and re-renders after it). Every sentence and number
   shown here comes from a core function (checklist, bindingsPass, coverage, goLivePreview, returnPreview, activatePreview,
   people, routing, serviceDates …); this file only lays them out.

   ROUTES
     p/:plant                         Home: Readiness while the plant is in Commissioning, Coverage once it is Live
     p/:plant/people                  People: reachability, roster, routing (the roster is edited here)
     p/:plant/people/service-dates    Last service dates (one per piece of equipment with a PM Task)
     p/:plant/review/bindings         The bindings pass   query: ?show=all|undecided|cantresolve|draft|needs  ?f=<binding id>
     p/:plant/library                 the same page, under v7/1's address

   API (window.V7PLANT)
     frame(key, active, bodyHtml, opts?) → the plant page frame: crumbs All Plants › Plant [› opts.crumbs], title, chips (type ·
       state · Sample plant / Real plant graph · on the home "{n} blockers"), the header link "Plant details" and the tabs.
       active = tab id: home · readings · structure · triggers · issues · tasks · people · deviations · activity (older ids such
       as differences and equipment are read as deviations and structure). opts: {crumbs, title, sub, chips, actions, aside,
       banner, cls, home (true on Readiness itself: adds the blockers chip)}. An unknown plant gives a "No such plant" page.
       Used by every module that draws a plant page.
     tabs(key) → [{id, label, href}] · stateChip(key) → the header's state chip · pages.{home, people, serviceDates, bindings}
     openGoLive(key) · openReturn(key) · openActivate(key, ref) · openLeaveInactive(key, ref) · openReject(key, pid)
       (ref: a Trigger id or a binding id "{node}|{alert|task|condition}|{name}")

   ACTIONS (data-act; data-plant on every one)
     plant:golive · plant:golive-confirm · plant:return · plant:return-confirm · plant:go (data-href: close the dialog, then go)
     bind:accept (data-pid) · bind:accept-draft (data-pid) · bind:group (data-group) · bind:bulk (data-show, data-activate 0|1) ·
       bind:bulk-confirm · bind:major (data-id)
     trig:activate (data-id: Trigger or binding id) · trig:activate-confirm · trig:inactive (data-id) · trig:inactive-confirm ·
       trig:reject (data-pid) · trig:reject-confirm
     ppl:add · ppl:edit (data-id) · ppl:save (data-id, empty for a new person) · ppl:send (data-id) · ppl:confirm (data-id) ·
       ppl:remove (data-id) · ppl:remove-confirm · ppl:hooter (data-on 1|0) · ppl:hooter-confirm
     sd:set (on a date field: data-eq, value YYYY-MM-DD) · sd:clear (data-eq)
   [Add parameter] on a binding that can't resolve carries data-act="dp:edit" with data-plant, data-id (and data-node), data-kind (up or eq), data-param and
   data-field ("dp.{param}"); the object pages own that editor.

   STYLES  assets/plant7.css (page-specific; v7.css tokens only). */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const U = W.V7UI;
  if (!U) { if (W.console) console.error('plant7.js needs ui7.js (window.V7UI) loaded first'); return; }
  const V = () => W.V7;
  const { esc, chip, btn, card, empty, note, table, stats } = U;

  /* ── helpers ──────────────────────────────────────────────────────────────────────────────────────────── */
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = (s) => encodeURIComponent(String(s));
  const has = (n) => { const v = V(); return !!v && typeof v[n] === 'function'; };
  const base = (key) => `#/p/${enc(key)}`;
  const trigHref = (key, id) => `${base(key)}/trigger/${enc(id)}`;
  const now = () => { const v = V(); return v && v.now ? v.now() : 0; };
  const fmtDay = (ms) => { const v = V(); return ms == null ? '—' : v && v.fmtDay ? v.fmtDay(ms) : U.fmtDay(ms); };
  const dget = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null);
  function call(fn, fb) { try { const r = fn(); return r == null ? fb : r; } catch (e) { if (W.console) console.error('[plant7]', e && e.message ? e.message : e); return fb; } }
  /* one card or block: if it fails, say so in place and keep the rest of the page */
  function part(label, fn) {
    try { return fn() || ''; } catch (e) { if (W.console) console.error('[plant7] ' + label, e); return note(`${label} could not be shown: ${e && e.message ? e.message : e}`, 'bad'); }
  }
  const H = (html) => ({ html: String(html) });           /* already-escaped html for the V7UI builders */
  const toast = (text, o) => U.toast(String(text == null ? '' : text), o);
  const closeAll = () => { try { U.closeModal(true); } catch (e) { /* none open */ } };
  /* a plant-graph node's page: unit processes live under up/, equipment under eq/ */
  const nodeHref = (key, id) => `${base(key)}/${has('isUp') && call(() => V().isUp(key, id), false) ? 'up' : 'eq'}/${enc(id)}`;
  /* a chip from a core chip object {text, tone, sub, small, extra} or a plain source word; the sub line stays visible */
  function chipOf(c) {
    if (!c) return '';
    if (typeof c === 'string') return chip(c, { tone: /^Derived/.test(c) ? 'der' : /^Override/.test(c) ? 'ovr' : /^Base moved/.test(c) ? 'moved' : /^Gap/.test(c) ? 'gap' : 'lib' });
    const main = chip(c.text || '', { tone: c.tone || 'lib' });
    const extra = arr(c.extra).map((x) => chip(x.text || '', { tone: x.tone || 'single' })).join(' ');
    return `${main}${extra ? ' ' + extra : ''}${c.sub ? `<span class="p7-chip-sub">${esc(c.sub)}</span>` : ''}${c.small ? `<span class="p7-chip-sub">${esc(c.small)}</span>` : ''}`;
  }
  /* the dialog (or sheet) a button sits in, and the value of a named field in it */
  function boxOf(el) {
    const b = el && el.closest ? (el.closest('.modal') || el.closest('.sheet')) : null;
    if (b) return b;
    const s = U.sheetEl ? U.sheetEl() : null; if (s && s.querySelector) return s;
    return typeof document !== 'undefined' && document.querySelector ? document : null;
  }
  function fieldOf(el, name) {
    const b = boxOf(el); if (!b || !b.querySelector) return null;
    return b.querySelector(`[name="${name}"]:checked`) || b.querySelector(`[name="${name}"]`) || b.querySelector(`#p7-${name}`);
  }
  function valOf(el, name) { const f = fieldOf(el, name); return f ? String(f.value == null ? '' : f.value) : ''; }
  /* an inline error under a field in an open dialog; without one, a toast */
  function fieldError(el, name, msg) {
    const f = fieldOf(el, name);
    if (!f) { toast(msg); return; }
    if (f.classList) f.classList.add('bad');
    const host = f.closest ? f.closest('.field') || f.parentNode : f.parentNode;
    if (host && host.querySelector && typeof document !== 'undefined' && document.createElement) {
      let e = host.querySelector('.field-e'); if (!e) { e = document.createElement('p'); e.className = 'field-e'; if (host.appendChild) host.appendChild(e); }
      e.textContent = msg;
    } else toast(msg);
    try { if (f.focus) f.focus(); } catch (e) { /* ignore */ }
  }

  /* ── the plant frame (shared by every plant route) ───────────────────────────────────────────────────── */
  const TAB_ALIAS = { differences: 'deviations', equipment: 'structure', readiness: 'home', coverage: 'home', review: 'home', scada: 'structure', library: 'home' };
  function plantOf(key) { const v = V(); return key && v && v.plant ? call(() => v.plant(key), null) : null; }
  const isLive = (p) => !!p && p.state === 'live';
  function tabs(key) {
    const p = plantOf(key) || {}; const b = base(key); const live = isLive(p);
    const un = Number(p.unclassified) || 0; const open = Number(p.openIssues) || 0;
    const list = [['home', live ? 'Coverage' : 'Readiness', '']]
      .concat(live ? [['readings', 'Readings', '/readings']] : [])
      .concat([['structure', un ? `Structure <span class="p7-tab-bad" title="${un} unclassified">${un}</span>` : 'Structure', '/structure'], ['triggers', 'Triggers', '/triggers'], ['issues', 'Issues', '/issues'], ['tasks', 'Tasks', '/tasks'], ['people', 'People', '/people'], ['deviations', 'Deviations', '/deviations'], ['activity', 'Activity', '/activity']]);
    return list.map(([id, label, suf]) => ({ id, label, href: b + suf, count: id === 'issues' && open ? open : null }));
  }
  /* "Commissioning · nothing is sent" on every page of a Commissioning plant; "Live since {Tue 1 Sep}" on a Live one */
  function stateChip(key) {
    const p = plantOf(key); if (!p) return '';
    return isLive(p) ? `<span class="chip st st-live p7-state">${esc(`Live since ${fmtDay(p.since)}`)}</span>` : '<span class="chip st st-comm p7-state">Commissioning · nothing is sent</span>';
  }
  function notFound(key) {
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', sub: key ? `There is no plant "${key}" in the prototype.` : '', body: empty('This plant is not in the prototype.', btn('All Plants', { href: '#/plants', kind: 'primary' })) });
  }
  function frame(key, active, body, opts) {
    const o = opts || {};
    const p = plantOf(key);
    if (!p) return notFound(key);
    const act = TAB_ALIAS[active] || active || 'home';
    const crumbs = [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }].concat(arr(o.crumbs));
    const tag = p.sample === false || p.realLayout ? chip('Real plant graph', { tone: 'info', title: 'The plant graph is the real survey layout; its readings are samples too' }) : chip('Sample plant', { tone: 'muted', title: 'A sample plant: its readings are generated samples' });
    let blockers = '';
    if (o.home && !isLive(p)) {
      const bc = call(() => V().checklist(key).blockersChip, null);
      if (bc && bc.text) blockers = chip(bc.text, { tone: bc.tone === 'bad' ? 'bad' : 'muted', cls: 'p7-blockers' });
    }
    const chips = [chip(p.type || '—', { mono: true }), stateChip(key), tag, blockers].concat(arr(o.chips));
    const actions = [`<a class="p7-details" href="${esc(base(key))}/details">Plant details</a>`].concat(arr(o.actions));
    return U.page({ crumbs, title: o.title || p.name, sub: o.sub || '', chips, actions, tabs: tabs(key), active: act, body, aside: o.aside, banner: o.banner, cls: ('pg-plant ' + (o.cls || '')).trim() });
  }
  function guard(params, fn) {
    const key = params && params.plant;
    if (!plantOf(key)) return notFound(key);
    return fn(key, (params && params._q) || {});
  }

  /* ── Readiness (Commissioning home) ───────────────────────────────────────────────────────────────────── */
  const MARK = { done: ['✓', 'Done'], current: ['●', 'Current'], waiting: ['○', 'Waiting'], attention: ['!', 'Needs attention'] };
  function actionHtml(a, kind) {
    if (!a || !a.label) return '';
    if (a.href) return `<a class="p7-act" href="${esc(a.href)}">${esc(a.label)}</a>`;
    if (a.act) return btn(a.label, { act: a.act, data: a.data, small: true, kind: kind || 'secondary' });
    return '';
  }
  function stepHtml(s) {
    const m = MARK[s.mark] || MARK.waiting; const a = s.action; const t = String(s.text || '');
    /* a waiting step that points onward ("Waiting for structure pass →") is itself the link */
    const linkText = a && a.href && s.mark === 'waiting' && /→\s*$/.test(t);
    const text = t ? (linkText ? `<a href="${esc(a.href)}">${esc(t)}</a>` : esc(t)) : '';
    const right = a && !linkText ? actionHtml(a, s.mark === 'attention' || s.mark === 'current' ? 'primary' : 'ghost') : '';
    return `<li class="p7-step is-${esc(s.mark || 'waiting')}"><span class="p7-mark" title="${m[1]}" aria-label="${m[1]}">${m[0]}</span><div class="p7-step-m"><span class="p7-step-l">${esc(s.label || '')}</span>${text ? `<span class="p7-step-t">${text}</span>` : ''}</div>${right ? `<div class="p7-step-r">${right}</div>` : ''}</li>`;
  }
  function trackCard(tr, id) {
    const steps = arr(tr && tr.steps);
    const att = steps.some((s) => s.mark === 'attention'); const done = steps.length && steps.every((s) => s.mark === 'done' || (id === 'people' && s.id === 'dates'));
    return card({ title: tr && tr.title ? tr.title : id, body: `<ol class="p7-steps">${steps.map(stepHtml).join('')}</ol>`, tone: att ? 'warn' : done ? 'ok' : null, cls: `p7-track p7-track-${id}` });
  }
  function trialBanner(cl) {
    const t = cl.trial; if (!t || !t.text) return '';
    return `<div class="p7-trial" role="status"><span class="p7-trial-t">${esc(t.text)}</span>${t.link ? `<a class="p7-act" href="${esc(t.link)}">${esc(t.linkText || 'Review them')}</a>` : ''}${U.sampleTag ? U.sampleTag() : ''}</div>`;
  }
  function itemRow(it, kind) {
    const tag = kind === 'blocker' ? '<span class="p7-tag p7-tag-bad">Blocker</span>' : '<span class="p7-tag p7-tag-gap">Gap</span>';
    const link = it.link ? `<a class="p7-act" href="${esc(it.link)}">${esc(it.linkText || 'Open')}</a>` : '';
    return `<li class="p7-item is-${kind}">${tag}<span class="p7-item-t">${esc(it.text || '')}</span>${link ? `<span class="p7-item-r">${link}</span>` : ''}</li>`;
  }
  function itemList(blockers, gaps) {
    const rows = arr(blockers).map((b) => itemRow(b, 'blocker')).concat(arr(gaps).map((g) => itemRow(g, 'gap')));
    return rows.length ? `<ul class="p7-items">${rows.join('')}</ul>` : '';
  }
  function beforeGoLive(key, cl) {
    const list = itemList(cl.blockers, cl.gaps);
    const body = list || `<p class="p7-none">${esc(cl.emptyText || 'Nothing blocks go-live and there are no gaps.')}</p>`;
    const role = `<span class="p7-role">${esc(cl.foot || 'Go live needs Full Admin')}</span>`;
    const foot = cl.canGoLive
      ? `<span class="p7-ready">${esc(cl.readyText || 'No blockers. Gaps don\'t stop go-live.')}</span>${role}${btn(cl.buttonLabel || 'Go live', { act: 'plant:golive', data: { plant: key }, kind: 'primary' })}`
      : `${role}${btn(cl.buttonLabel || 'Go live', { kind: 'primary', disabled: true, title: cl.firstBlocker || cl.whyNot || '' })}`;
    return card({ title: 'Before go-live', body, foot, cls: 'p7-before' });
  }
  function readiness(key) {
    const cl = has('checklist') ? call(() => V().checklist(key), null) : null;
    if (!cl) return frame(key, 'home', note('Readiness could not be worked out for this plant.', 'bad'));
    const t = cl.tracks || {};
    const body = [
      part('The trial', () => trialBanner(cl)),
      part('The three tracks', () => `<div class="p7-tracks">${['structure', 'bindings', 'people'].map((id) => trackCard(t[id], id)).join('')}</div>`),
      part('Before go-live', () => beforeGoLive(key, cl)),
    ].join('');
    return frame(key, 'home', body, { cls: 'p7-home', home: true });
  }

  /* ── Coverage (Live home) ─────────────────────────────────────────────────────────────────────────────── */
  function triggersCard(key, c) {
    const t = c.triggers || {}; const w = c.window || {};
    const noisiest = t.noisiest ? `<a href="${esc(trigHref(key, t.noisiest.alertId))}">${esc(t.noisiest.name)}</a>` : '—';
    const tiles = stats([
      { value: String(t.active != null ? t.active : 0), label: 'Active' },
      { value: String(t.issues != null ? t.issues : 0), label: w.label || 'Issues, last 7 days' },
      { value: t.falseAlarmText || '—', label: H(`Closed as false alarm<small class="p7-small">${esc(t.closedText || '')}</small>`) },
      { value: H(noisiest), label: 'Noisiest' },
    ]);
    const drafts = `<p class="p7-drafts">${esc(t.draftsText || '')}${t.draftsLink ? ` <a class="p7-act" href="${esc(t.draftsLink)}">${esc(t.draftsLinkText || 'Open the bindings pass')}</a>` : ''}</p>`;
    return card({ title: 'Triggers', body: tiles + drafts, actions: [U.sampleTag ? U.sampleTag() : '', btn('All Triggers', { href: `${base(key)}/triggers`, kind: 'ghost', small: true })], cls: 'p7-cov p7-cov-trig' });
  }
  function deviationsCard(key, c) {
    const d = c.deviations || {};
    const tiles = stats([
      { value: String(d.overrides || 0), label: 'Overrides' },
      { value: String(d.baseMoved || 0), label: 'Base moved', tone: d.baseMoved ? 'warn' : null },
      { value: String(d.pastReview != null ? d.pastReview : d.reviewPassed || 0), label: 'Past review' },
    ]);
    return card({ title: 'Deviations here', body: tiles, actions: [btn('Open deviations', { href: c.deviationsLink || `${base(key)}/deviations`, kind: 'ghost', small: true })], cls: 'p7-cov p7-cov-dev' });
  }
  function blindCard(c) {
    const b = c.blindSpots || {};
    return card({ title: 'Blind spots', body: `<p class="p7-placeholder">${esc(b.text || '')}</p>`, cls: 'p7-cov p7-cov-blind' });
  }
  function gapsCard(c) {
    const gs = arr(c.gaps);
    return card({ title: 'Gaps the plant runs with', body: gs.length ? itemList([], gs) : `<p class="p7-none">${esc(c.gapsEmpty || 'No gaps.')}</p>`, cls: 'p7-cov p7-cov-gaps' });
  }
  function returnCard(key, c) {
    const r = c.returnCard || {};
    return card({ sub: r.text || '', actions: [btn(r.button || 'Return to Commissioning…', { act: 'plant:return', data: { plant: key }, kind: 'danger' })], tone: 'quiet', cls: 'p7-return' });
  }
  function coverage(key) {
    const c = has('coverage') ? call(() => V().coverage(key), null) : null;
    if (!c) return frame(key, 'home', note('Coverage could not be worked out for this plant.', 'bad'));
    const body = [
      c.freshText ? `<div class="p7-fresh" role="status">${esc(c.freshText)}</div>` : '',
      part('Triggers', () => triggersCard(key, c)),
      `<div class="p7-cov-row">${part('Deviations here', () => deviationsCard(key, c))}${part('Blind spots', () => blindCard(c))}</div>`,
      part('Gaps the plant runs with', () => gapsCard(c)),
      part('Return to Commissioning', () => returnCard(key, c)),
    ].join('');
    return frame(key, 'home', body, { cls: 'p7-home' });
  }
  function home(params) { return guard(params, (key) => (isLive(plantOf(key)) ? coverage(key) : readiness(key))); }

  /* ── the bindings pass ────────────────────────────────────────────────────────────────────────────────── */
  const SHOWS = ['all', 'undecided', 'cantresolve', 'draft', 'needs'];
  const OLD_SHOW = { decided: 'all', blocked: 'needs', drafts: 'draft' };   /* v7/1's filters under the old address */
  const ST_CLS = { undecided: 'p7-st-und', cantResolve: 'p7-st-cant', draft: 'st-draft', active: 'st-on', inactive: 'st-off', rejected: 'st-off', needs: 'st-off' };
  function statusChip(r) {
    const cls = r.status === 'active' && /trial/.test(r.statusLabel || '') ? 'st-trial' : ST_CLS[r.status] || 'st-off';
    return `<span class="chip st ${cls} p7-st">${esc(r.statusLabel || r.status || '')}</span>`;
  }
  function addParamBtn(key, r) {
    const cr = r.cantResolve || {}; if (!cr.param) return '';
    return btn('Add parameter', { act: 'dp:edit', data: { plant: key, node: r.eqId, id: r.eqId, kind: has('isUp') && call(() => V().isUp(key, r.eqId), false) ? 'up' : 'eq', param: cr.param, field: `dp.${cr.param}` }, small: true });
  }
  function valuesCell(key, r) {
    if (r.status === 'cantResolve') return `<span class="p7-cant">Can't resolve: ${esc((r.cantResolve && r.cantResolve.text) || 'no limit rule')}</span> ${addParamBtn(key, r)}`;
    const vs = arr(r.values); if (!vs.length) return '<span class="muted">—</span>';
    return `<ul class="p7-vals">${vs.map((v) => `<li><span class="p7-val">${esc(v.text || '')}</span> ${chipOf(v.chip || v.source)}</li>`).join('')}</ul>`;
  }
  function rowActions(key, r, live) {
    const d = { plant: key, pid: r.pid };
    switch (r.status) {
      case 'undecided': {
        const change = r.href ? `<a class="p7-act" href="${esc(r.href)}">Change</a>` : r.reads && r.reads.sensorId ? `<a class="p7-act" href="${esc(base(key))}/sensor/${enc(r.reads.sensorId)}" title="Limits are edited on the sensor">Change</a>` : '';
        return btn('Accept', { act: 'bind:accept', data: d, small: true, kind: 'primary', title: live ? 'Accepted as a draft: it never fires until it is activated' : 'It goes active: trial firings only, nothing is sent' }) + change + btn('Reject', { act: 'trig:reject', data: d, small: true, kind: 'ghost' });
      }
      case 'cantResolve': return btn('Accept as draft', { act: 'bind:accept-draft', data: d, small: true });
      case 'draft': return btn('Activate', { act: 'trig:activate', data: { plant: key, id: r.alertId || r.pid }, small: true, kind: 'primary' }) + btn('Leave inactive', { act: 'trig:inactive', data: { plant: key, id: r.alertId || r.pid }, small: true, kind: 'ghost' });
      default: return r.href ? `<a class="p7-act" href="${esc(r.href)}">Open</a>` : '';
    }
  }
  function groupCard(key, g, q, live) {
    const rows = arr(g.items).map((r) => ({
      _cls: q.f && q.f === r.pid ? 'is-target' : '',
      what: H(`<span class="p7-line">${r.href ? `<a href="${esc(r.href)}">${esc(r.line || r.name)}</a>` : esc(r.line || r.name)}</span>${r.readsText ? `<span class="p7-reads">${esc(r.readsText)}</span>` : ''}`),
      vals: H(valuesCell(key, r)),
      st: H(statusChip(r)),
      acts: H(`<div class="p7-row-a">${rowActions(key, r, live)}</div>`),
    }));
    const head = g.upId ? `<a href="${esc(nodeHref(key, g.upId))}">${esc(g.head || g.label)}</a>` : esc(g.head || g.label);
    const accept = g.acceptCount ? btn(`Accept ${g.acceptCount}`, { act: 'bind:group', data: { plant: key, group: g.id }, small: true, title: live ? 'Accepted as drafts: they never fire until activated' : 'They go active: trial firings only, nothing is sent' }) : '';
    return card({ title: H(head), body: table({ cols: [{ label: 'Template → where', key: 'what' }, { label: 'Values · source', key: 'vals' }, { label: 'Status', key: 'st' }, { label: '', key: 'acts', cls: 'p7-acts' }], rows, empty: false }), actions: [accept], cls: 'p7-bgroup' });
  }
  function passTabs(key, bp) {
    const sp = has('structurePass') ? call(() => V().structurePass(key), null) : null;
    const done = has('structureDone') ? call(() => V().structureDone(key), true) : true;
    const left = sp && sp.counts ? sp.counts.toReview : null;
    const s = `<a class="p7-pass" href="${esc(base(key))}/review/structure">${done ? 'Structure pass ✓' : `Structure pass · ${left != null ? left : ''}`.trim()}</a>`;
    const b = bp && bp.open ? `<a class="p7-pass on" aria-current="page" href="${esc(base(key))}/review/bindings">Bindings pass · ${bp.counts.all}</a>` : '<span class="p7-pass is-off" aria-disabled="true">Bindings pass · waiting</span>';
    return `<nav class="p7-passes" aria-label="Review queue">${s}${b}</nav>`;
  }
  function bindings(params) {
    return guard(params, (key, q) => {
      const crumbs = [{ label: 'Review' }];
      const p = plantOf(key); const live = isLive(p);
      let show = OLD_SHOW[q.show] || q.show; if (!SHOWS.includes(show)) show = 'all';
      const bp = has('bindingsPass') ? call(() => V().bindingsPass(key, { show }), null) : null;
      if (!bp) return frame(key, 'home', note('The bindings pass could not be worked out for this plant.', 'bad'), { crumbs, title: 'Review' });
      const parts = [passTabs(key, bp)];
      if (!bp.open) {
        parts.push(card({ body: `<p>${esc(bp.waitingText || 'The bindings pass opens when the structure pass is confirmed.')}</p>`, foot: btn('Go to the structure pass', { href: `${base(key)}/review/structure`, kind: 'primary' }), cls: 'p7-waiting' }));
        return frame(key, 'home', parts.join(''), { crumbs, title: 'Review' });
      }
      /* the structure pass confirmed under a day ago: say so once */
      const sp = has('structurePass') ? call(() => V().structurePass(key), null) : null;
      if (sp && sp.banner && sp.confirmedAt != null && now() - sp.confirmedAt < 864e5 && now() >= sp.confirmedAt) parts.push(`<div class="p7-fresh" role="status">✓ ${esc(sp.banner)}</div>`);
      const c = bp.counts || {}; const qs = (s) => `${base(key)}/review/bindings${s === 'all' ? '' : `?show=${s}`}`;
      const chips = [
        { id: 'all', label: 'All', n: c.all }, { id: 'undecided', label: 'Undecided', n: c.undecided }, { id: 'cantresolve', label: 'Can\'t resolve', n: c.cantResolve, cls: 'p7-f-gap' },
        { id: 'draft', label: 'Drafts', n: c.drafts, hide: !c.drafts && show !== 'draft' }, { id: 'needs', label: 'Needs equipment or sensors', n: c.needs },
      ].filter((x) => !x.hide);
      parts.push(`<nav class="filters p7-filters">${chips.map((x) => `<a class="filter${x.cls ? ' ' + x.cls : ''}${show === x.id ? ' on' : ''}" href="${esc(qs(x.id))}"${show === x.id ? ' aria-current="true"' : ''}>${esc(x.label)} <span class="filter-n">${esc(x.n != null ? x.n : 0)}</span></a>`).join('')}</nav>`);
      /* the bulk bar: undecided rows that resolve, in this filter */
      const bk = bp.bulk || {}; const dis = !!bk.disabled;
      const bulk = `<div class="p7-bulk">${btn(bk.draftsLabel || 'Accept as drafts', { act: 'bind:bulk', data: { plant: key, show, activate: 0 }, disabled: dis, title: dis ? bk.disabledTitle : '' })}${btn(bk.activateLabel || 'Accept', { act: 'bind:bulk', data: { plant: key, show, activate: 1 }, kind: 'primary', disabled: dis, title: dis ? bk.disabledTitle : '' })}${bk.note ? `<span class="p7-bulk-n">${esc(bk.note)}</span>` : ''}</div>`;
      parts.push(bulk);
      /* new versions to accept (a Major library change waits here) */
      const md = arr(bp.majorDrafts);
      if (md.length) parts.push(card({ title: 'New versions to accept', body: `<ul class="p7-items">${md.map((m) => `<li class="p7-item"><span class="p7-item-t">${m.href ? `<a href="${esc(m.href)}">${esc(m.text || m.name)}</a>` : esc(m.text || m.name)}</span><span class="p7-item-r">${btn('Accept', { act: 'bind:major', data: { plant: key, id: m.id }, small: true, kind: 'primary' })}</span></li>`).join('')}</ul>`, cls: 'p7-major' }));
      const groups = arr(bp.groups);
      if (groups.length) parts.push(`<div class="p7-bgroups">${groups.map((g) => part(g.label || 'A group', () => groupCard(key, g, q, live))).join('')}</div>`);
      else if (show !== 'needs') parts.push(empty({ all: 'The library proposes nothing for this plant.', undecided: 'Nothing left to decide.', cantresolve: 'Every binding here resolves its limits.', draft: 'No drafts.' }[show] || 'Nothing here.', show !== 'all' ? btn('Show all', { href: qs('all') }) : ''));
      /* Needs equipment or sensors: what the plant graph lacks, one line per piece of equipment and reading */
      const needs = arr(bp.needs);
      if (needs.length && (show === 'all' || show === 'needs')) parts.push(card({ title: `Needs equipment or sensors · ${c.needs} ${c.needs === 1 ? 'template' : 'templates'}`, body: `<ul class="p7-needs">${needs.map((n) => `<li>${esc(n.text || '')}</li>`).join('')}</ul>`, tone: 'quiet', cls: 'p7-needs-card' }));
      return frame(key, 'home', parts.join(''), { crumbs, title: 'Review' });
    });
  }

  /* ── People ───────────────────────────────────────────────────────────────────────────────────────────── */
  function verifiedCell(key, p) {
    const d = { plant: key, id: p.id };
    switch (p.verifiedState) {
      case 'verified': return chip('Verified', { tone: 'ok' });
      case 'unverified': return `${chip('Not verified', { tone: 'warn' })} ${btn('Send code', { act: 'ppl:send', data: d, small: true })}`;
      case 'sent': return `<span class="p7-sent">${esc(p.verifiedText || '')}</span><span class="p7-ver-a">${btn('Send again', { act: 'ppl:send', data: d, small: true, kind: 'ghost' })}${btn(p.sampleConfirm || 'Enters the code', { act: 'ppl:confirm', data: d, small: true, cls: 'p7-sample' })}</span>`;
      default: return `<span class="muted">${esc(p.verifiedText || 'No phone')}</span>`;
    }
  }
  function rosterCard(key, ppl, p) {
    if (!ppl.length) return card({ title: 'Roster', body: empty(`No one is on ${p.name}'s roster yet. Add at least one Operator and one Lead, each with a phone they verify.`, btn('Add a person', { act: 'ppl:add', data: { plant: key }, kind: 'primary' })), cls: 'p7-roster' });
    const rows = ppl.map((x) => ({
      name: H(`<b>${esc(x.name)}</b>`), role: x.roleLabel || '', phone: x.number ? H(`<span class="mono">${esc(x.number)}</span>`) : '—',
      ver: H(verifiedCell(key, x)), chan: x.channelText || '', grant: x.grantLabel || '—',
      acts: H(`<div class="p7-row-a">${btn('Edit', { act: 'ppl:edit', data: { plant: key, id: x.id }, small: true, kind: 'ghost' })}${btn('Remove', { act: 'ppl:remove', data: { plant: key, id: x.id }, small: true, kind: 'ghost' })}</div>`),
    }));
    return card({ title: 'Roster', body: table({ cols: [{ label: 'Name', key: 'name' }, { label: 'Role', key: 'role' }, { label: 'Phone', key: 'phone' }, { label: 'Verified', key: 'ver' }, { label: 'Channel', key: 'chan' }, { label: 'Admin grant', key: 'grant' }, { label: '', key: 'acts', cls: 'p7-acts' }], rows }), cls: 'p7-roster' });
  }
  function routingCard(key, live) {
    const r = call(() => V().routing(key), null); if (!r) return '';
    const ladder = `<ul class="p7-ladder">${arr(r.ladder).map((l) => `<li class="p7-rung p7-rung-${esc(l.band)}"><span class="p7-rung-t">${esc(l.text)}</span><span class="p7-rung-n">${esc(l.countText || '')}</span></li>`).join('')}</ul>`;
    const on = r.hooter !== false;
    const hooter = `<div class="p7-hooter"><span class="p7-hooter-l">${esc(r.hooterLabel || 'Hooter at this plant')}</span><span class="p7-seg" role="group" aria-label="${esc(r.hooterLabel || 'Hooter at this plant')}">${btn('On', { act: 'ppl:hooter', data: { plant: key, on: 1 }, small: true, kind: on ? 'primary' : 'ghost', cls: on ? 'on' : '' })}${btn('Off', { act: 'ppl:hooter', data: { plant: key, on: 0 }, small: true, kind: on ? 'ghost' : 'primary', cls: on ? '' : 'on' })}</span></div>`;
    const clocks = `<p class="p7-clocks">${esc(r.clocksText || '')}</p>${r.clocksNote ? `<p class="p7-clocks-n">${esc(r.clocksNote)}</p>` : ''}`;
    const dates = live ? '' : `<p class="p7-more"><a href="${esc(base(key))}/people/service-dates">Last service dates</a></p>`;
    return card({ title: r.title || 'Routing', sub: r.sub || '', body: (r.banner ? `<div class="p7-comm" role="status">${esc(r.banner)}</div>` : '') + ladder + hooter + clocks + dates, cls: 'p7-routing' });
  }
  function people(params) {
    return guard(params, (key) => {
      const p = plantOf(key); const live = isLive(p);
      const crumbs = [{ label: 'People' }];
      if (!has('people')) return frame(key, 'people', note('People could not be read for this plant.', 'bad'), { crumbs, title: 'People' });
      const ppl = arr(call(() => V().people(key), []));
      const rc = call(() => V().reachability(key), null);
      const reach = rc ? `<div class="p7-reach tone-${rc.ok ? 'ok' : 'bad'}" role="status"><span class="p7-mark">${rc.ok ? '✓' : '!'}</span> ${esc(rc.text)}</div>` : '';
      const body = [reach, part('Roster', () => rosterCard(key, ppl, p)), part('Routing', () => routingCard(key, live))].join('');
      return frame(key, 'people', body, { crumbs, title: 'People', actions: [btn('Add a person', { act: 'ppl:add', data: { plant: key }, kind: 'primary' })] });
    });
  }
  const ROLES = [['l1', 'Operator'], ['l3', 'Lead'], ['l4', 'Senior Lead'], ['regular', 'Client viewer']];
  const CHANNELS = [['wa', 'WhatsApp'], ['sms', 'SMS']];
  const GRANTS = [['', 'None'], ['people', 'People Admin'], ['tech', 'Technical Admin'], ['full', 'Full Admin']];
  function choice(name, list, value) {
    return `<div class="p7-choice" role="radiogroup">${list.map(([v, l]) => `<label class="p7-opt${String(v) === String(value) ? ' on' : ''}"><input type="radio" name="${name}" value="${esc(v)}"${String(v) === String(value) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
  }
  function personForm(key, id, vals, err) {
    const v = vals || {}; const e = err || {};
    return U.field({ label: 'Name', error: e.field === 'name' ? e.error : null, html: `<input type="text" id="p7-name" name="name" value="${esc(v.name || '')}" placeholder="For example: Ravi Kumar" autocomplete="off">` })
      + U.field({ label: 'Role', error: e.field === 'role' ? e.error : null, html: choice('role', ROLES, v.role || 'l1') })
      + U.field({ label: 'Phone', hint: id ? 'Changing the number means verifying it again.' : 'They verify it themselves with a code.', error: e.field === 'phone' ? e.error : null, html: `<input type="tel" id="p7-phone" name="phone" value="${esc(v.phone || '')}" placeholder="+91 90000 40001" autocomplete="off">` })
      + U.field({ label: 'Channel', error: e.field === 'channel' ? e.error : null, html: choice('channel', CHANNELS, v.channel || 'wa') })
      + U.field({ label: 'Admin grant at this plant', error: e.field === 'grant' ? e.error : null, html: choice('grant', GRANTS, v.grant || '') })
      + (e.error && !['name', 'role', 'phone', 'channel', 'grant'].includes(e.field) ? `<p class="field-e">${esc(e.error)}</p>` : '');
  }
  function personVals(key, id) {
    const x = id ? arr(call(() => V().people(key), [])).find((y) => y.id === id) : null;
    if (!x) return { name: '', role: 'l1', phone: '', channel: 'wa', grant: '' };
    return { name: x.name, role: x.role, phone: x.number || '', channel: (x.phone && x.phone.channel) || 'wa', grant: x.grant || '' };
  }
  function openPerson(key, id) {
    const x = id ? arr(call(() => V().people(key), [])).find((y) => y.id === id) : null;
    if (id && !x) { toast('That person is no longer on the roster.'); return; }
    U.openSheet({ title: x ? `Edit ${x.name}` : 'Add a person', body: personForm(key, id, personVals(key, id)), foot: btn('Cancel', { act: 'ui:close', data: { what: 'sheet' }, kind: 'ghost' }) + btn('Save', { act: 'ppl:save', data: { plant: key, id: id || '' }, kind: 'primary' }) });
  }
  /* save the add / edit sheet; an error keeps the sheet open with what was typed and the message by its field */
  function savePerson(key, id, vals) {
    const r = id ? call(() => V().updatePerson(key, id, vals), { ok: false, error: 'That did not work.' }) : call(() => V().addPerson(key, vals), { ok: false, error: 'That did not work.' });
    if (!r.ok) { try { U.refreshSheet({ body: personForm(key, id, vals, r) }); } catch (e) { /* no sheet open */ } if (!U.sheetEl || !U.sheetEl()) toast(r.error); return r; }
    try { U.closeSheet(); } catch (e) { /* none open */ }
    toast(r.toast || 'Saved.');
    return r;
  }

  /* ── Last service dates ───────────────────────────────────────────────────────────────────────────────── */
  function serviceDates(params) {
    return guard(params, (key) => {
      const crumbs = [{ label: 'People', href: `${base(key)}/people` }, { label: 'Last service dates' }];
      const sd = has('serviceDates') ? call(() => V().serviceDates(key), null) : null;
      if (!sd) return frame(key, 'people', note('Last service dates could not be read for this plant.', 'bad'), { crumbs, title: 'Last service dates' });
      const parts = [];
      if (sd.live) {
        parts.push(note(sd.liveText || '', 'info'));
        const rec = arr(sd.rows).filter((r) => r.date != null);
        if (rec.length) parts.push(card({ title: 'Entered during Commissioning', body: table({ cols: [{ label: 'Equipment', key: 'eq' }, { label: 'Last service', key: 'd' }], rows: rec.map((r) => ({ eq: H(`<a class="mono" href="${esc(nodeHref(key, r.eqId))}">${esc(r.tag)}</a> ${esc(r.name || '')}`), d: r.dateText })) }) }));
        return frame(key, 'people', parts.join(''), { crumbs, title: sd.title || 'Last service dates' });
      }
      parts.push(`<p class="p7-counter">${esc(sd.counterText || '')}</p>`);
      const rows = arr(sd.rows).map((r) => ({
        eq: H(`<a class="mono" href="${esc(nodeHref(key, r.eqId))}">${esc(r.tag)}</a> <span>${esc(r.name || '')}</span><span class="p7-reads">${esc(r.typeName || '')}</span>`),
        pm: String(r.pmTasks != null ? r.pmTasks : ''),
        last: H(`<input type="date" class="p7-date" name="sd-${esc(r.eqId)}" value="${esc(r.iso || '')}" max="${esc(sd.max || '')}" data-act="sd:set" data-plant="${esc(key)}" data-eq="${esc(r.eqId)}" aria-label="Last service of ${esc(r.tag)}">${r.dateText ? `<span class="p7-reads">${esc(r.dateText)}</span>` : ''}`),
        first: (r.preview && r.preview.text) || '',
        clear: H(r.date != null ? btn('Clear', { act: 'sd:clear', data: { plant: key, eq: r.eqId }, small: true, kind: 'ghost' }) : ''),
      }));
      parts.push(card({ body: table({ cols: [{ label: 'Equipment', key: 'eq' }, { label: 'PM Tasks', key: 'pm', cls: 'num' }, { label: 'Last service', key: 'last' }, { label: 'First PM due at go-live', key: 'first' }, { label: '', key: 'clear', cls: 'p7-acts' }], rows, empty: 'No equipment has a PM Task yet.' }), foot: sd.foot ? `<span class="muted">${esc(sd.foot)}</span>` : '', cls: 'p7-dates' }));
      return frame(key, 'people', parts.join(''), { crumbs, title: sd.title || 'Last service dates', sub: sd.sub || '' });
    });
  }

  /* ── dialogs: go live, return, activate, leave inactive, reject ───────────────────────────────────────── */
  const closeBtn = (label) => btn(label || 'Not yet', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' });
  const goLink = (href, label) => `<a href="${esc(href)}" data-act="plant:go" data-href="${esc(href)}">${esc(label)}</a>`;
  const linesHtml = (lines, ordered) => `<${ordered ? 'ol' : 'ul'} class="p7-changes">${arr(lines).map((l) => `<li${l.loud ? ' class="p7-loud"' : ''}>${esc(l.text)}${l.sub ? `<div class="p7-sub">${esc(l.sub)}</div>` : ''}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
  function openGoLive(key) {
    const pv = has('goLivePreview') ? call(() => V().goLivePreview(key), null) : null;
    if (!pv) { toast('Go live could not be prepared.'); return; }
    if (!pv.canGoLive) { const cl = pv.checklist || {}; toast(cl.firstBlocker ? `Go live is blocked: ${cl.firstBlocker}` : cl.buttonLabel || 'Go live is blocked.'); return; }
    const tr = pv.trial || {};
    const trial = `<div class="p7-pv">${esc(tr.text || '')}${tr.linkText && tr.link ? ` · ${goLink(tr.link, tr.linkText)}` : ''}</div>`;
    const gaps = arr(pv.gaps);
    const gapsHtml = gaps.length
      ? `<details class="p7-gaps"><summary><span>${esc(pv.gapsText || '')}</span> · <span class="p7-list">${esc(pv.gapsLinkText || 'List')}</span></summary>${itemList([], gaps)}</details>`
      : `<p class="p7-gaps">${esc(pv.gapsText || 'No gaps remain')}</p>`;
    const b = arr(pv.buttons);
    U.modal({ title: pv.title || 'Go live', body: `<p class="p7-head">${esc(pv.head || 'From now on:')}</p>${linesHtml(pv.lines, true)}${trial}${gapsHtml}`, foot: closeBtn(b[0]) + btn(b[1] || 'Go live', { act: 'plant:golive-confirm', data: { plant: key }, kind: 'primary' }), cls: 'p7-modal' });
  }
  function openReturn(key) {
    const rp = has('returnPreview') ? call(() => V().returnPreview(key), null) : null;
    if (!rp) { toast('Return to Commissioning could not be prepared.'); return; }
    const b = arr(rp.buttons);
    const body = `<p class="p7-head">${esc(rp.head || 'From now on:')}</p>${linesHtml(rp.lines, false)}<p class="p7-muted">${esc(rp.note || '')}</p>`
      + U.field({ label: rp.reasonLabel || 'Why it goes back', html: `<textarea id="p7-reason" name="reason" rows="2" placeholder="${esc(rp.placeholder || '')}"></textarea>` });
    U.modal({ title: rp.title || 'Return to Commissioning?', body, foot: closeBtn(b[0]) + btn(b[1] || 'Return to Commissioning', { act: 'plant:return-confirm', data: { plant: key }, kind: 'danger' }) });
  }
  /* the binding row (by binding id or Trigger id) and the Trigger's name and status */
  function targetOf(key, ref) {
    const s = String(ref || ''); const rows = arr(call(() => V().bindingsPass(key).rows, []));
    const row = s.includes('|') ? rows.find((r) => r.pid === s) : rows.find((r) => r.alertId === s);
    const alertId = s.includes('|') ? (row ? row.alertId : null) : s;
    const name = alertId && has('triggerName') ? call(() => V().triggerName(key, alertId), null) : null;
    const st = alertId && has('alertState') ? call(() => V().alertState(key, alertId), null) : null;
    return { row, alertId, name: name || (row ? row.name : alertId ? call(() => V().alert(key, alertId).name, s) : s), state: st || (row ? (row.status === 'draft' ? 'draft' : row.status) : null) };
  }
  function bandsBlock(ap) {
    const ls = arr(ap.bandLines); if (!ls.length) return '';
    return `<p class="p7-head">${esc(ap.bandsTitle || '')}</p><ul class="p7-bands">${ls.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  }
  function openActivate(key, ref, bulk) {
    const ap = has('activatePreview') ? call(() => V().activatePreview(key, ref), null) : null;
    if (!ap) { toast('Activate could not be prepared.'); return; }
    const b = arr(ap.buttons);
    const confirm = bulk ? btn(b[b.length - 1] || 'Activate', { act: 'bind:bulk-confirm', data: { plant: key, show: bulk.show, activate: 1 }, kind: 'primary' }) : btn(b[b.length - 1] || 'Activate', { act: 'trig:activate-confirm', data: { plant: key, id: ref }, kind: 'primary' });
    const back = ap.live ? btn(b[1] || 'Return the plant to Commissioning…', { act: 'plant:return', data: { plant: key }, kind: 'ghost' }) : '';
    U.modal({ title: ap.title || 'Activate?', body: `${arr(ap.lines).map((l) => `<p class="p7-para">${esc(l)}</p>`).join('')}${bandsBlock(ap)}`, foot: closeBtn(b[0]) + back + confirm });
  }
  /* the five reasons, asked first, when a Live plant sets an active Trigger inactive (an override of "enabled") */
  function enabledFallback(key, id) {
    const target = { kind: 'enabled', alertId: id };
    const keys = has('reasonsFor') ? arr(call(() => V().reasonsFor(key, target), [])) : ['physical', 'regulatory', 'structural', 'tuning', 'temporary'];
    const L = (V().LABELS && V().LABELS.reason) || {};
    return U.field({ label: 'Why does this plant differ?', html: `<div class="p7-choice" role="radiogroup">${keys.map((k) => `<label class="p7-opt"><input type="radio" name="why" value="${esc(k)}"><span>${esc(L[k] || k)}</span></label>`).join('')}</div>` })
      + U.field({ label: 'Note', html: '<textarea id="p7-note" name="note" rows="2"></textarea>' })
      + U.field({ label: 'Expires on (Temporary only)', html: '<input type="date" id="p7-expires" name="expires">' });
  }
  function openLeaveInactive(key, ref) {
    const tg = targetOf(key, ref); const p = plantOf(key);
    if (isLive(p) && tg.alertId && tg.state === 'active') {
      const LG = W.V7LEDGER; const form = LG && typeof LG.overrideForm === 'function' ? call(() => LG.overrideForm(key, { kind: 'enabled', alertId: tg.alertId }, { inModal: true }), null) : null;
      const head = `<p class="p7-para">${esc(`${p.name} is Live: setting ${tg.name} inactive is an override of this plant's value, with a reason.`)}</p>`;
      /* the ledger's own form carries Cancel and Save; closing the dialog any other way closes the form too */
      if (form) { const tgt = { kind: 'enabled', alertId: tg.alertId }; U.modal({ title: `Set ${tg.name} inactive?`, body: head + form, onClose: () => { if (typeof LG.close === 'function') call(() => LG.close(key, tgt), null); } }); return; }
      U.modal({ title: `Set ${tg.name} inactive?`, body: head + enabledFallback(key, tg.alertId), foot: closeBtn('Cancel') + btn('Set inactive', { act: 'trig:inactive-confirm', data: { plant: key, id: tg.alertId, live: 1 }, kind: 'primary' }) });
      return;
    }
    const active = tg.state === 'active';
    const body = `<p class="p7-para">${esc(active ? 'It stays at this plant but never fires: it records no trial firings.' : 'It stays at this plant but never fires. It no longer blocks go-live.')}</p>`
      + U.field({ label: 'Why', html: '<textarea id="p7-reason" name="reason" rows="2" placeholder="For example: no MLSS probe fitted until December"></textarea>' });
    U.modal({ title: active ? `Set ${tg.name} inactive?` : `Leave ${tg.name} inactive?`, body, foot: closeBtn('Cancel') + btn(active ? 'Set inactive' : 'Leave inactive', { act: 'trig:inactive-confirm', data: { plant: key, id: ref }, kind: 'primary' }) });
  }
  function openReject(key, pid) {
    const tg = targetOf(key, pid); const r = tg.row;
    if (!r) { toast('That binding is no longer there.'); return; }
    const body = '<p class="p7-para">The library keeps it; this plant won\'t. A re-run won\'t propose it again.</p>' + U.field({ label: 'Why', html: '<textarea id="p7-reason" name="reason" rows="2"></textarea>' });
    U.modal({ title: `Reject ${r.template} for ${r.subjectTag || r.tag}?`, body, foot: closeBtn('Cancel') + btn('Reject', { act: 'trig:reject-confirm', data: { plant: key, pid }, kind: 'danger' }) });
  }
  /* a toast from a core result, with Undo while the binding decisions can still be undone */
  function decisionToast(key, r) {
    const undo = r && r.batchId && has('undoDecision') ? () => { const u = call(() => V().undoDecision(key, r.batchId), { ok: false }); if (!u.ok && u.error) toast(u.error); } : null;
    toast(r.toast || 'Done.', undo ? { undo, ms: 10000 } : { ms: 7000 });
  }

  /* ── actions ──────────────────────────────────────────────────────────────────────────────────────────── */
  U.on('plant:go', (el) => { closeAll(); U.go(dget(el, 'href') || '#/plants'); return false; });
  U.on('plant:golive', (el) => { openGoLive(dget(el, 'plant')); return false; });
  U.on('plant:golive-confirm', (el) => {
    const key = dget(el, 'plant'); const r = call(() => V().goLive(key), { ok: false, error: 'Go live did not work.' });
    closeAll();
    toast(r.ok ? r.toast : r.error || 'Go live did not work.', { ms: 8000 });
    if (r.ok) U.go(base(key));
    return undefined;
  });
  U.on('plant:return', (el) => { openReturn(dget(el, 'plant')); return false; });
  U.on('plant:return-confirm', (el) => {
    const key = dget(el, 'plant'); const why = valOf(el, 'reason').trim();
    const r = call(() => V().returnToCommissioning(key, why), { ok: false, error: 'That did not work.' });
    if (!r.ok) { if (r.field === 'reason') { fieldError(el, 'reason', r.error); return false; } closeAll(); toast(r.error); return undefined; }
    closeAll(); toast(r.toast, { ms: 8000 }); return undefined;
  });
  U.on('bind:accept', (el) => {
    const key = dget(el, 'plant'); const live = isLive(plantOf(key));
    const r = call(() => V().decide(key, dget(el, 'pid'), 'accept', { activate: !live }), { ok: false, error: 'That did not work.' });
    if (!r.ok) toast(r.error || 'That did not work.'); else decisionToast(key, r);
  });
  U.on('bind:accept-draft', (el) => {
    const key = dget(el, 'plant'); const r = call(() => V().decide(key, dget(el, 'pid'), 'accept', { activate: false }), { ok: false, error: 'That did not work.' });
    if (!r.ok) toast(r.error || 'That did not work.'); else decisionToast(key, r);
  });
  U.on('bind:group', (el) => {
    const key = dget(el, 'plant'); const live = isLive(plantOf(key));
    const r = call(() => V().acceptAllFor(key, { groupId: dget(el, 'group') }, { activate: !live }), { ok: false, error: 'That did not work.' });
    if (!r.ok) toast(r.error || 'That did not work.'); else decisionToast(key, r);
  });
  function bulkRun(key, show, activate) {
    const sel = show === 'all' || show === 'undecided' || !show ? { status: 'undecided' } : { pids: arr(call(() => V().bindingsPass(key, { show }).rows, [])).filter((r) => r.status === 'undecided').map((r) => r.pid) };
    return call(() => V().acceptAllFor(key, sel, { activate }), { ok: false, error: 'That did not work.' });
  }
  U.on('bind:bulk', (el) => {
    const key = dget(el, 'plant'); const show = dget(el, 'show') || 'all'; const activate = dget(el, 'activate') === '1';
    if (activate && isLive(plantOf(key))) {
      const pids = arr(call(() => V().bindingsPass(key, { show }).rows, [])).filter((r) => r.status === 'undecided').map((r) => r.pid);
      if (!pids.length) { toast('Nothing left to accept here.'); return false; }
      openActivate(key, { pids }, { show }); return false;
    }
    const r = bulkRun(key, show, activate);
    if (!r.ok) toast(r.error || 'That did not work.'); else decisionToast(key, r);
    return undefined;
  });
  U.on('bind:bulk-confirm', (el) => {
    const key = dget(el, 'plant'); const r = bulkRun(key, dget(el, 'show') || 'all', true);
    closeAll(); if (!r.ok) toast(r.error || 'That did not work.'); else decisionToast(key, r);
    return undefined;
  });
  U.on('bind:major', (el) => {
    const key = dget(el, 'plant'); const r = call(() => V().acceptMajorDraft(key, dget(el, 'id')), { ok: false, error: 'That did not work.' });
    toast(r.ok ? r.toast || 'Accepted.' : r.error || 'That did not work.');
  });
  U.on('trig:activate', (el) => {
    const key = dget(el, 'plant'); const ref = dget(el, 'id');
    if (isLive(plantOf(key))) { openActivate(key, ref); return false; }
    const r = call(() => V().activate(key, ref), { ok: false, error: 'That did not work.' });
    toast(r.ok ? r.toast || 'Active.' : r.error || 'That did not work.', { ms: 7000 });
    return undefined;
  });
  U.on('trig:activate-confirm', (el) => {
    const key = dget(el, 'plant'); const r = call(() => V().activate(key, dget(el, 'id')), { ok: false, error: 'That did not work.' });
    closeAll(); toast(r.ok ? r.toast || 'Active.' : r.error || 'That did not work.', { ms: 7000 });
    return undefined;
  });
  U.on('trig:inactive', (el) => { openLeaveInactive(dget(el, 'plant'), dget(el, 'id')); return false; });
  U.on('trig:inactive-confirm', (el) => {
    const key = dget(el, 'plant'); const ref = dget(el, 'id');
    let r;
    if (dget(el, 'live') === '1') {
      const reason = valOf(el, 'why'); const note2 = valOf(el, 'note').trim(); const ex = valOf(el, 'expires');
      r = call(() => V().setAlertState(key, ref, 'inactive', { reason, note: note2, expires: ex || undefined }), { ok: false, error: 'That did not work.' });
      if (!r.ok) { fieldError(el, r.field === 'note' ? 'note' : r.field === 'expires' ? 'expires' : 'why', r.error); return false; }
    } else {
      r = call(() => V().leaveInactive(key, ref, { reason: valOf(el, 'reason').trim() }), { ok: false, error: 'That did not work.' });
      if (!r.ok && r.field === 'reason') { fieldError(el, 'reason', r.error); return false; }
    }
    closeAll(); toast(r.ok ? r.toast || 'Inactive.' : r.error || 'That did not work.', { ms: 7000 });
    return undefined;
  });
  U.on('trig:reject', (el) => { openReject(dget(el, 'plant'), dget(el, 'pid')); return false; });
  U.on('trig:reject-confirm', (el) => {
    const key = dget(el, 'plant'); const r = call(() => V().decide(key, dget(el, 'pid'), 'reject', { reason: valOf(el, 'reason').trim() }), { ok: false, error: 'That did not work.' });
    if (!r.ok && r.field === 'reason') { fieldError(el, 'reason', r.error); return false; }
    closeAll(); if (!r.ok) toast(r.error || 'That did not work.'); else decisionToast(key, r);
    return undefined;
  });
  U.on('ppl:add', (el) => { openPerson(dget(el, 'plant'), null); return false; });
  U.on('ppl:edit', (el) => { openPerson(dget(el, 'plant'), dget(el, 'id')); return false; });
  U.on('ppl:save', (el) => {
    const key = dget(el, 'plant'); const id = dget(el, 'id') || null;
    const vals = { name: valOf(el, 'name'), role: valOf(el, 'role'), phone: valOf(el, 'phone'), channel: valOf(el, 'channel'), grant: valOf(el, 'grant') };
    const r = savePerson(key, id, vals);
    return r.ok ? undefined : false;
  });
  U.on('ppl:send', (el) => { const r = call(() => V().sendCode(dget(el, 'plant'), dget(el, 'id')), { ok: false, error: 'That did not work.' }); toast(r.ok ? r.toast : r.error); });
  U.on('ppl:confirm', (el) => { const r = call(() => V().confirmCode(dget(el, 'plant'), dget(el, 'id')), { ok: false, error: 'That did not work.' }); toast(r.ok ? r.toast || 'Verified.' : r.error); });
  U.on('ppl:remove', (el) => {
    const key = dget(el, 'plant'); const id = dget(el, 'id'); const rp = call(() => V().removePreview(key, id), null);
    if (!rp) { toast('That person is no longer on the roster.'); return false; }
    U.modal({ title: rp.title, body: `<p class="p7-para">${esc(rp.text)}</p>`, foot: closeBtn('Cancel') + btn('Remove', { act: 'ppl:remove-confirm', data: { plant: key, id }, kind: 'danger' }) });
    return false;
  });
  U.on('ppl:remove-confirm', (el) => { const r = call(() => V().removePerson(dget(el, 'plant'), dget(el, 'id')), { ok: false, error: 'That did not work.' }); closeAll(); toast(r.ok ? r.toast : r.error); });
  U.on('ppl:hooter', (el) => {
    const key = dget(el, 'plant'); const on = dget(el, 'on') === '1';
    const r0 = call(() => V().routing(key), null); if (!r0) return false;
    if ((r0.hooter !== false) === on) return false;
    if (!on) { U.modal({ title: 'Switch the hooter off?', body: `<p class="p7-para">${esc(r0.offConfirm || '')}</p>`, foot: closeBtn('Cancel') + btn('Switch off', { act: 'ppl:hooter-confirm', data: { plant: key }, kind: 'danger' }) }); return false; }
    const r = call(() => V().setRouting(key, { hooter: true }), { ok: false, error: 'That did not work.' }); toast(r.ok ? r.toast || 'Hooter switched on.' : r.error);
    return undefined;
  });
  U.on('ppl:hooter-confirm', (el) => { const r = call(() => V().setRouting(dget(el, 'plant'), { hooter: false }), { ok: false, error: 'That did not work.' }); closeAll(); toast(r.ok ? r.toast || 'Hooter switched off.' : r.error); });
  U.on('sd:set', (el) => {
    const key = dget(el, 'plant'); const eq = dget(el, 'eq'); const v = String((el && el.value) || '').trim();
    const r = call(() => V().setServiceDate(key, eq, v || null), { ok: false, error: 'That did not work.' });
    if (!r.ok) toast(r.error); else if (r.changed !== false && r.toast) toast(r.toast);
  });
  U.on('sd:clear', (el) => { const r = call(() => V().setServiceDate(dget(el, 'plant'), dget(el, 'eq'), null), { ok: false, error: 'That did not work.' }); toast(r.ok ? r.toast || 'Cleared.' : r.error); });

  /* a highlighted binding (?f=<binding id>) scrolls into view */
  if (U.afterRender) U.afterRender((main, path) => { if (!/^p\/[^/]+\/(review\/bindings|library)$/.test(String(path || '')) || !main || !main.querySelector) return; const t = main.querySelector('.is-target'); if (t && t.scrollIntoView) { try { t.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ } } });

  /* ── routes ───────────────────────────────────────────────────────────────────────────────────────────── */
  U.route('p/:plant', home);
  U.route('p/:plant/people', people);
  U.route('p/:plant/people/service-dates', serviceDates);
  U.route('p/:plant/review/bindings', bindings);
  U.route('p/:plant/library', bindings);

  /* our stylesheet, if the page does not link it already */
  try { if (typeof document !== 'undefined' && document.querySelector && !document.querySelector('link[href*="plant7.css"]')) U.addCss('assets/plant7.css?v=1'); } catch (e) { /* ignore */ }

  W.V7PLANT = { frame, tabs, stateChip, openGoLive, openReturn, openActivate, openLeaveInactive, openReject, savePerson, pages: { home, people, serviceDates, bindings } };
}());
