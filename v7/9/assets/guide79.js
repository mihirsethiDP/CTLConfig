/* v7/9 · guide79.js — Alerts & Tasks while a plant is being set up, one part at a time.
   The page used to show everything at once: three summary cards, two rows of filters, every unit process, the equipment outside
   them, the plant's rounds, alerts across readings, timelines, calculated values and the plant's own additions.
   Here it is four parts, in the order a person works, and only one is on screen:
     1 Unit processes · 2 Other equipment and the plant · 3 Alerts across readings · 4 Review and plant rules
   Nothing is removed: the summaries and the optional rules sit in the last part. A Live plant keeps the page it had.
   window.V7GUIDE = { parts, progress(key) → { process, other, across: { total, done, left } }, step(key), go(key, i) } */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, d) => { try { const r = fn(); return r == null ? d : r; } catch (e) { return d; } };
  const PARTS = [
    { id: 'process', label: 'Unit processes', intro: 'One line per treatment step. Accept what the library drafted for it, or open it to go line by line.' },
    { id: 'other', label: 'Other equipment and the plant', intro: 'Equipment that sits in no unit process, and the rounds for the plant as a whole.' },
    { id: 'across', label: 'Alerts across readings', intro: 'Alerts that watch more than one reading. Apply the ones that fit. Some ask which sensor to read.' },
    { id: 'review', label: 'Review and plant rules', intro: 'What this plant takes from the library. The rules below follow the library already: change one only where this plant differs.' },
  ];
  /* how far each part is, counted in whole unit processes, types and alerts: a person finishes those, not single lines */
  function progress(key) {
    const v = V(); const lr = arr(safe(() => v.libraryReview(key), [])); const ups = arr(safe(() => v.structure(key).ups, []));
    const home = new Map(); ups.forEach((u) => { if (!home.has(u.id)) home.set(u.id, u.id); }); ups.forEach((u) => arr(u.members).forEach((m) => { if (!home.has(m.eqId)) home.set(m.eqId, u.id); }));
    const g1 = new Map(); const g2 = new Map();
    lr.forEach((r) => { const ps = arr(r.proposals).filter((p) => !p.blockedBy); if (!ps.length) return; const up = r.eqId === 'plant' ? null : home.get(r.eqId) || null;
      const m = up ? g1 : g2; const k = up || (r.eqId === 'plant' ? '@plant' : 't:' + r.typeName); const c = m.get(k) || { und: 0 }; c.und += ps.filter((p) => !p.decided).length; m.set(k, c); });
    const tally = (m) => { const a = [...m.values()]; return { total: a.length, done: a.filter((c) => !c.und).length, left: a.reduce((s, c) => s + c.und, 0) }; };
    const of = arr(safe(() => W.V7UPALERT.offers(key), [])).filter((o) => !o.skipped);
    return { process: tally(g1), other: tally(g2), across: { total: of.length, done: of.filter((o) => o.state).length, left: of.filter((o) => !o.state).length } };
  }
  const STEP = {}; const LASTQ = {};
  const first = (key) => { const p = progress(key); return p.process.left ? 0 : p.other.left ? 1 : p.across.left ? 2 : 3; };
  const step = (key) => (STEP[key] == null ? first(key) : STEP[key]);
  W.V7GUIDE = { parts: PARTS, progress, step, go: (key, i) => { STEP[key] = Math.max(0, Math.min(PARTS.length - 1, +i || 0)); return STEP[key]; } };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn;
  const stateText = (i, pr) => { if (i === 3) return 'Optional'; const c = i === 0 ? pr.process : i === 1 ? pr.other : pr.across; return !c.total ? 'Nothing here' : c.done === c.total ? 'Done' : `${c.done} of ${c.total} done`; };
  const isDone = (i, pr) => { if (i === 3) return false; const c = i === 0 ? pr.process : i === 1 ? pr.other : pr.across; return c.total > 0 && c.done === c.total; };

  function show(body, key) {
    const i = step(key); const pr = progress(key);
    Array.prototype.forEach.call(body.querySelectorAll(':scope > .g9-p'), (p) => { p.hidden = +p.getAttribute('data-i') !== i; });
    Array.prototype.forEach.call(body.querySelectorAll('.g9-s'), (b) => { const k = +b.getAttribute('data-i'); b.classList.toggle('is-on', k === i); if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    const tools = body.querySelector('.g9-tools'); const slot = body.querySelector(`.g9-p[data-i="${i}"] .g9-slot`); if (tools) { if (slot) { slot.appendChild(tools); tools.hidden = false; } else tools.hidden = true; }
    if (i === 2) { const d = body.querySelector('#ua-card'); if (d && !d.open) d.open = true; }
    const foot = body.querySelector('.g9-foot');
    if (foot) {
      const left = i === 0 ? pr.process.left : i === 1 ? pr.other.left : i === 2 ? pr.across.left : 0; const b = `#/p/${encodeURIComponent(key)}`;
      const back = i > 0 ? btn(`Back: ${PARTS[i - 1].label}`, { act: 'g9:go', data: { plant: key, i: i - 1 }, kind: 'ghost' }) : '<span></span>';
      const next = i < PARTS.length - 1 ? btn(`Next: ${PARTS[i + 1].label}`, { act: 'g9:go', data: { plant: key, i: i + 1 }, kind: left ? 'secondary' : 'primary', title: left ? 'You can come back: what is undecided here waits for you' : '' }) : btn('Back to the set-up', { href: b, kind: 'primary' });
      foot.innerHTML = `${back}<span class="g9-foot-n">Part ${i + 1} of ${PARTS.length}</span>${next}`;
    }
  }

  function build(main, key) {
    const body = main.querySelector('.pg-main'); if (!body || body.classList.contains('g9')) return; const head = body.querySelector(':scope > .p7-sec-h'); if (!head) return;
    body.classList.add('g9'); const pr = progress(key);
    const q = (() => { const s = String(location.hash || '').split('?')[1] || ''; const o = {}; s.split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) o[k] = decodeURIComponent(v || ''); }); o._ = s; return o; })();
    ['.p7-jump', '.p7-fold-hint', '.note'].forEach((sel) => Array.prototype.forEach.call(body.querySelectorAll(`:scope > ${sel}`), (e) => e.remove()));
    const kids = Array.prototype.slice.call(body.children).filter((c) => c !== head);
    const lvl = kids.filter((c) => c.classList.contains('lvl-card')); const sums = kids.filter((c) => c.classList.contains('p7-sum') && !c.classList.contains('lvl-card'));
    const filt = body.querySelector(':scope > nav.filters'); const fk = body.querySelector(':scope > .p7-fkind'); const cards = body.querySelector(':scope > .p7-cards');
    const zone = (id) => body.querySelector(`:scope > #p7-zone-${id}`); const zAcross = zone('across'); const zRules = zone('rules'); const zOwn = zone('own');
    const known = new Set([].concat(lvl, sums, [filt, fk, cards, zAcross, zRules, zOwn]).filter(Boolean)); const rest = kids.filter((c) => !known.has(c));
    const showing = q.show || (filt && filt.querySelector('.filter.on') ? '' : '');
    const panel = (i) => { const s = document.createElement('section'); s.className = 'g9-p'; s.setAttribute('data-i', i); s.setAttribute('aria-label', PARTS[i].label); s.innerHTML = `<header class="g9-ph"><h3>${esc(PARTS[i].label)}</h3><p>${esc(PARTS[i].intro)}</p></header>${i < 2 ? '<div class="g9-slot"></div>' : ''}`; return s; };
    const P = PARTS.map((x, i) => panel(i));
    /* the lists: unit processes in part 1; the equipment outside them and the plant's own rounds in part 2 */
    const lists = [document.createElement('div'), document.createElement('div')]; lists.forEach((d) => { d.className = 'p7-cards'; });
    if (cards) { let to = 0; Array.prototype.slice.call(cards.children).forEach((c) => { if (c.id === 'p7-cat-process') { to = 0; c.remove(); return; } if (c.id === 'p7-cat-equipment' || c.id === 'p7-cat-plant') to = 1; lists[to].appendChild(c); }); cards.remove(); }
    const none = (i) => { const c = i === 0 ? pr.process : pr.other; const filtered = q.kind || (q.show && q.show !== 'undecided'); return `<p class="g9-none">${!c.total ? 'The library has nothing to decide here for this plant.' : filtered ? 'Nothing here under this filter.' : 'Everything here is decided.'}</p>`; };
    /* how much routine work the site takes on is a choice to make before the lists; where there is nothing to choose it is a note for the review */
    lvl.forEach((c) => (c.querySelector('.lvl') ? P[0] : P[3]).appendChild(c));
    [0, 1].forEach((i) => { if (lists[i].children.length) P[i].appendChild(lists[i]); else P[i].insertAdjacentHTML('beforeend', none(i)); });
    rest.forEach((c) => c.remove());
    if (zAcross) P[2].appendChild(zAcross); else P[2].insertAdjacentHTML('beforeend', '<p class="g9-none">No alert across readings fits this plant.</p>');
    /* the review: what the plant takes from the library, open. The card that counts lines to decide belongs to the lists, so it
       shows here only once everything is decided, when it says so and leads back to the set-up */
    sums.forEach((c) => { if (c.querySelector('[data-act="p7:lib-accept-all"]')) { c.remove(); return; } P[3].appendChild(c); }); if (sums[0] && sums[0].parentNode === P[3] && !sums[0].classList.contains('is-flat')) sums[0].open = true;
    /* the plant's own rounds: one heading and one line, not a card around a line of the same name */
    Array.prototype.forEach.call(lists[1].querySelectorAll(':scope > section.card.p7-type > .card-h'), (h) => h.remove()); [zRules, zOwn].forEach((z) => { if (z) P[3].appendChild(z); });
    /* the filters: one quiet row, with the kinds of work behind a fold */
    const tools = document.createElement('div'); tools.className = 'g9-tools'; if (filt) tools.appendChild(filt);
    if (fk) { const d = document.createElement('details'); d.className = 'g9-kind'; if (q.kind) d.open = true; d.innerHTML = `<summary>${q.kind ? 'Filtered by kind of work' : 'Filter by kind of work'}</summary>`; d.appendChild(fk); tools.appendChild(d); }
    const nav = document.createElement('nav'); nav.className = 'g9-steps'; nav.setAttribute('aria-label', 'Alerts and Tasks, part by part');
    nav.innerHTML = `<ol>${PARTS.map((x, i) => `<li><button type="button" class="g9-s${isDone(i, pr) ? ' is-done' : ''}" data-act="g9:go" data-plant="${esc(key)}" data-i="${i}"><span class="g9-n" aria-hidden="true">${isDone(i, pr) ? '✓' : i + 1}</span><span class="g9-t"><span class="g9-l">${esc(x.label)}</span><span class="g9-c">${esc(stateText(i, pr))}</span></span></button></li>`).join('')}</ol>`;
    const foot = document.createElement('div'); foot.className = 'g9-foot';
    body.appendChild(nav); if (tools.children.length) body.appendChild(tools); P.forEach((p) => body.appendChild(p)); body.appendChild(foot);
    /* each line says less: its kind is the heading above it, and the long help line is two words until opened */
    Array.prototype.forEach.call(body.querySelectorAll('.hp > summary'), (s) => { const t = s.lastChild; if (t && t.nodeType === 3) t.textContent = /can't be used/i.test(t.textContent) ? 'Why not yet' : 'What it does'; });
    /* a link that asks for a filter or for one piece of equipment lands on the lists, not on the review */
    if (LASTQ[key] !== undefined && LASTQ[key] !== q._ && (q.show || q.kind || q.eq)) { const inP1 = !!P[1].querySelector('details.p7-eq[open]'); const inP0 = !!P[0].querySelector('details.p7-eq[open]'); if (q.eq) STEP[key] = inP1 && !inP0 ? 1 : 0; else if (step(key) > 1) STEP[key] = lists[0].children.length || !lists[1].children.length ? 0 : 1; }
    else if (STEP[key] == null && q.eq) { STEP[key] = P[1].querySelector('details.p7-eq[open]') && !P[0].querySelector('details.p7-eq[open]') ? 1 : 0; }
    LASTQ[key] = q._; if (STEP[key] == null) STEP[key] = first(key);
    show(body, key);
  }
  U.on('g9:go', (el) => { const key = el.getAttribute('data-plant'); W.V7GUIDE.go(key, el.getAttribute('data-i')); const body = document.querySelector('.pg-main.g9'); if (body) { show(body, key); const n = body.querySelector('.g9-steps'); if (n && n.scrollIntoView) n.scrollIntoView({ block: 'start' }); } return false; });
  /* a count of a kind of work shows where those lines are: it opens what holds them, marks them and dims the rest.
     It stays while you work in that unit process, and a second press clears it. */
  const HIT = {}; const each = (list, fn) => Array.prototype.forEach.call(list, fn);
  function markKind(fold, k, scroll) {
    each(fold.querySelectorAll('.is-hit[data-kind]'), (e) => e.classList.remove('is-hit')); each(fold.querySelectorAll('.p7-kinds-b'), (b) => b.setAttribute('aria-pressed', b.getAttribute('data-kind') === k ? 'true' : 'false')); fold.classList.toggle('has-kind', !!k); if (!k) return 0;
    const hits = Array.prototype.filter.call(fold.querySelectorAll('[data-kind]'), (e) => e.getAttribute('data-kind') === k && !e.classList.contains('p7-kinds-b'));
    hits.forEach((e) => { e.classList.add('is-hit'); let d = e.parentNode; while (d && d !== fold) { if (d.tagName === 'DETAILS' && !d.open) d.open = true; d = d.parentNode; } });
    if (scroll && hits[0] && hits[0].scrollIntoView) hits[0].scrollIntoView({ block: 'center' }); return hits.length;
  }
  U.on('p7:kind-hit', (el) => { const fold = el.closest('details.p7-type, section.card'); if (!fold) return false; const k = el.getAttribute('aria-pressed') === 'true' ? null : el.getAttribute('data-kind'); const id = fold.getAttribute('data-keep'); if (id) { if (k) HIT[id] = k; else delete HIT[id]; } markKind(fold, k, true); return false; });
  /* a tile of the unit process shows where that piece of equipment's lines are */
  let EQ = null;
  function markEq(id, scroll) {
    each(document.querySelectorAll('details.p7-eq.is-hit'), (e) => e.classList.remove('is-hit')); each(document.querySelectorAll('.p7-upmap-t'), (b) => b.setAttribute('aria-pressed', id && b.getAttribute('data-eq') === id ? 'true' : 'false')); if (!id) return true;
    const t = Array.prototype.find.call(document.querySelectorAll('details.p7-eq'), (e) => e.getAttribute('data-eq') === id); if (!t) return false;
    let d = t.parentNode; while (d && d.tagName !== 'MAIN') { if (d.tagName === 'DETAILS' && !d.open) d.open = true; d = d.parentNode; } t.open = true; t.classList.add('is-hit'); if (scroll && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); return true;
  }
  U.on('p7:eq-hit', (el) => { const id = el.getAttribute('data-eq'); if (el.getAttribute('aria-pressed') === 'true') { EQ = null; markEq(null); return false; } if (!markEq(id, true)) { EQ = null; markEq(null); U.toast('Nothing is listed for it under this filter. Choose All to see every line.'); return false; } EQ = id; return false; });
  if (U.afterRender) U.afterRender((main) => { setTimeout(() => { try { each(main.querySelectorAll('details.p7-type[data-keep]'), (f) => { const k = HIT[f.getAttribute('data-keep')]; if (k && f.open) markKind(f, k, false); }); if (EQ && !markEq(EQ, false)) EQ = null; } catch (e) { /* nothing is marked */ } }, 0); });
  if (U.afterRender) U.afterRender((main, p0) => {
    try {
      if (!main) return; const m = /^p\/([^/?]+)\/library$/.exec(String(p0 || location.hash).replace(/^#?\/?/, '').split('?')[0]); if (!m) return; const key = decodeURIComponent(m[1]);
      if (safe(() => V().state(key), 'live') === 'live') return;
      setTimeout(() => { try { build(main, key); } catch (e) { /* the page still shows, all on one screen */ } }, 0);
    } catch (e) { /* the page still shows, all on one screen */ }
  });
})();
