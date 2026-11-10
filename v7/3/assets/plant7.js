/* v7 · plant7.js · window.V7PLANT — the plant pages.

   Loads after core7.js (window.V7) and ui7.js (window.V7UI). Pure string renderers registered with V7UI.route; every
   action is a data-act handler registered with V7UI.on (the shell persists and re-renders after it).

   ROUTES
     p/:plant             Home: Readiness while the plant is in Commissioning, Coverage once it is Live
     p/:plant/scada       What the plant graph has (accept per database type, or all; not-in-database; drawn ≠ stored; next phase)
     p/:plant/library     What the library brings (per equipment, grouped by type; Accept → On trial; Not for this plant + reason)
                          query: ?show=undecided|decided|blocked|all  ?eq=<eqId> (opens that equipment)
     p/:plant/equipment   Equipment list by database type          query: ?show=all|issues|diffs|drawn
     p/:plant/readings    Every reading grouped by equipment, both states  query: ?show=all|nolimits|manual|next
     p/:plant/tasks       Set-level tasks (one per type, to confirm) + PM/calibration per equipment + the plant; tasks a day both ways

   API (window.V7PLANT)
     frame(key, active, bodyHtml, opts?) → the plant page frame (crumbs All Plants › Plant [› opts.crumbs], title, chips: type ·
       state · Sample plant / Real plant graph, state line, tabs Home · Equipment · Readings · Issues · Tasks · Differences ·
       Activity). active = tab id ('home'|'equipment'|'readings'|'issues'|'tasks'|'differences'|'activity').
       opts: {crumbs:[{label,href}], title, sub, chips:[html], actions:[html], aside, banner, cls}. Unknown plant → a "No such
       plant" page. Used by ui7 (Activity), lib7 (Differences) and work7 (Issues).
     pages.{home, scada, library, equipment, readings, tasks}(params) → html (the route functions)
     tabs(key) → [{id,label,href,count}] · typePlural(typeName, n) → "5 Blowers", "2 ACF/MGF" · openGoLive(key) · openReturn(key)

   ACTIONS (data-act)  p7:scada-accept · p7:scada-accept-all · p7:scada-fix · p7:lib-accept · p7:lib-accept-eq ·
     p7:lib-accept-type · p7:lib-accept-all · p7:lib-reject (+ p7:lib-reject-confirm, p7:reason-pick) · p7:golive
     (+ p7:golive-confirm) · p7:return (+ p7:return-confirm) · p7:usercenter · p7:search

   STYLES  assets/plant7.css (small; page-specific). The integrator links it in prototype.html after v7.css; if it is not
     linked, this module adds the <link> itself at load. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const U = W.V7UI;
  if (!U) { if (W.console) console.error('plant7.js needs ui7.js (window.V7UI) loaded first'); return; }
  const V = () => W.V7;
  const { esc, chip, btn, card, list, empty, note, banner, table, stats, filters } = U;

  /* ── helpers ──────────────────────────────────────────────────────────────────────────────────────────── */
  const DAY = 864e5;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = (s) => encodeURIComponent(String(s));
  const pl = (n, one, many) => U.plural(n, one, many);
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const uniq = (xs) => [...new Set(xs)];
  const base = (key) => `#/p/${enc(key)}`;
  const eqHref = (key, eqId, tab) => `${base(key)}/eq/${enc(eqId)}${tab ? '/' + tab : ''}`;
  const alertHref = (key, id) => `${base(key)}/alert/${enc(id)}`;
  const issueHref = (key, id) => `${base(key)}/issue/${enc(id)}`;
  const taskHref = (key, id) => `${base(key)}/task/${enc(id)}`;
  const libHref = (code) => `#/library/${enc(code)}`;
  const now = () => { const v = V(); return v && v.now ? v.now() : Date.now(); };
  const fmt = (ms) => (ms == null ? '—' : U.fmt(ms));
  const fmtDay = (ms) => (ms == null ? '—' : U.fmtDay(ms));
  function call(fn, fb) { try { const r = fn(); return r == null ? fb : r; } catch (e) { if (W.console) console.error('[plant7]', e && e.message ? e.message : e); return fb; } }
  /* one card or block: if it fails, say so in place and keep the rest of the page */
  function part(label, fn) {
    try { return fn() || ''; } catch (e) { if (W.console) console.error('[plant7] ' + label, e); return note(`${label} could not be shown: ${e && e.message ? e.message : e}`, 'bad'); }
  }
  /* v7: the shared formatters (V7UI.rate / V7UI.dur), so Coverage and the alert page show the same numbers */
  function rate(x) { if (U.rate) return U.rate(x); if (!isNum(x) || x === 0) return '0'; return x >= 1 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100); }
  function pct(x) { return isNum(x) ? `${Math.round(x * 100)}%` : '—'; }
  function minutes(m) { if (U.dur) return U.dur(m); const v = V(); return isNum(m) ? (v && v.fmtDur ? v.fmtDur(m) : `${m} min`) : '—'; }
  function shortList(names, n) { const xs = arr(names).filter(Boolean); const k = n || 4; return xs.length <= k ? xs.join(' · ') : `${xs.slice(0, k).join(' · ')} · and ${xs.length - k} more`; }
  function fmtVal(v, unit, kind) { const c = V(); return c && c.fmtVal ? c.fmtVal(v, unit, kind) : U.num(v, unit); }
  /* stored type names stay exactly as stored; only a plain "s" is added ("5 Blowers", "2 ACF/MGF", "3 MBBR") */
  function typePlural(name, n) {
    const s = String(name || '');
    if (n === 1 || !s || /\//.test(s) || /^[A-Z0-9 ]+$/.test(s)) return s;
    return /(s|x|sh|ch)$/i.test(s) ? s + 'es' : s + 's';
  }
  const countType = (n, name) => `${n} ${typePlural(name, n)}`;
  const pieces = (n) => `${n} ${n === 1 ? 'piece' : 'pieces'} of equipment`;
  const dget = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null);
  const tagOf = (key, eqId) => { const e = eqId ? call(() => V().eq(key, eqId), null) : null; return e ? e.tag : ''; };
  const eqOfPid = (pid) => String(pid || '').split('|')[0];
  const H = (html) => ({ html: String(html) });                 /* already-escaped html for V7UI builders (txt() escapes plain strings) */
  const say = (html, o) => U.toast(`<span>${html}</span>`, o);  /* toasts: escaped html, always wrapped so it is never escaped twice */

  /* ── the plant frame (shared by every plant route, also ui7/lib7/work7) ─────────────────────────────────────── */
  const TABS = [['home', 'Home', ''], ['structure', 'Structure', '/structure'], ['library', 'Library', '/library'], ['equipment', 'Equipment', '/equipment'], ['readings', 'Readings', '/readings'], ['issues', 'Issues', '/issues'], ['tasks', 'Tasks', '/tasks'], ['differences', 'Differences', '/differences'], ['activity', 'Activity', '/activity']];
  function plantOf(key) { const v = V(); return key && v ? call(() => v.plant(key), null) : null; }
  function tabs(key) {
    const p = plantOf(key) || {};
    return TABS.map(([id, label, suf]) => ({ id, label, href: base(key) + suf, count: id === 'issues' && p.openIssues ? p.openIssues : id === 'differences' && p.differences ? p.differences : null }));
  }
  function trialStart(key) {
    const ts = arr(call(() => V().alerts(key, { state: 'trial' }), [])).map((a) => a.trialSince).filter(isNum);
    return ts.length ? Math.min(...ts) : null;
  }
  function stateLine(p) {
    const cap = p.capacity ? `${p.capacity} · ` : '';
    if (p.state === 'live') return `${cap}Live since ${fmtDay(p.since)}. Alerts reach the plant's people; an Emergency calls everyone and sounds the hooter.`;
    const ts = trialStart(p.key); const day = ts != null ? Math.floor((now() - ts) / DAY) + 1 : null;
    return `${cap}Commissioning since ${fmt(p.since)}${day ? ` · day ${day} of the trial` : ''}. Nothing is sent to anyone yet, Emergencies included; every firing is kept as a trial firing.`;
  }
  function notFound(key) {
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', sub: key ? `There is no plant "${key}" in the prototype.` : '', body: empty('This plant is not in the prototype.', btn('All Plants', { href: '#/plants', kind: 'primary' })) });
  }
  function frame(key, active, body, opts) {
    const o = opts || {};
    const p = plantOf(key);
    if (!p) return notFound(key);
    const crumbs = [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }].concat(arr(o.crumbs));
    const chips = [chip(p.type || '—', { mono: true }), U.stateChip(p.state), p.sample ? chip('Sample plant', { tone: 'muted', title: 'A sample plant: its readings are generated samples' }) : chip('Real plant graph', { tone: 'info', title: "The layout is the plant's real plant graph; its readings are samples" })].concat(arr(o.chips));
    return U.page({ crumbs, title: o.title || p.name, sub: o.sub != null ? o.sub : stateLine(p), chips, actions: o.actions, tabs: tabs(key), active: active || 'home', body, aside: o.aside, banner: o.banner, cls: ('pg-plant ' + (o.cls || '')).trim() });
  }
  function guard(params, fn) {
    const key = params && params.plant;
    if (!plantOf(key)) return notFound(key);
    return fn(key, (params && params._q) || {});
  }

  /* ── shared pieces: checklist rows ───────────────────────────────────────────────────────────────────── */
  const FIX = { notindb: 'Review', scada: 'Review', library: 'Decide', alerts: 'Accept alerts', nolimits: 'See the readings', noisy: 'See the alert', notask: 'See the equipment', nodiag: 'See the library', drawn: 'Review' };
  function itemsPreview(key, it) {
    const items = arr(it.items); if (!items.length) return '';
    if (items.length === 1 && (it.id === 'library' || it.id === 'noisy')) return '';   /* the text already names it */
    let names;
    switch (it.id) {
      case 'library': names = items.map((x) => `${x.name} on ${x.tag}`); break;
      case 'nolimits': names = items.map((x) => { const t = tagOf(key, x.eqId); return `${x.name}${x.tag ? ` (${x.tag})` : ''}${t ? ` on ${t}` : ''}`; }); break;
      case 'noisy': names = items.map((x) => `${x.name}: ${rate(x.perDay)} trial firings a day`); break;
      case 'notask': names = items.map((x) => x.tag); break;
      case 'nodiag': names = items.map((x) => x.name); break;
      case 'drawn': names = items.map((x) => `${x.tag}: drawn as ${x.drawn}, stored as ${x.stored}`); break;
      default: names = items.map((x) => x.name || x.tag || '');
    }
    return shortList(names, it.id === 'notask' ? 8 : 3);
  }
  function fixAction(key, it) {
    const b = base(key);
    if (it.id === 'operator' || it.id === 'lead') return btn('Edit in the User Center', { act: 'p7:usercenter', small: true, kind: 'ghost' });
    if (!it.link || it.link === b) return '';
    let href = it.link;
    if (it.id === 'library' && arr(it.items).length === 1) href = `${b}/library?eq=${enc(eqOfPid(it.items[0].pid))}`;
    if (it.id === 'noisy' && arr(it.items).length > 1) href = b;
    if (it.id === 'nolimits') href = `${b}/readings?show=nolimits`;
    return `<a class="p7-fix" href="${esc(href)}">${esc(FIX[it.id] || 'Open')} →</a>`;
  }
  function checkRows(key, items, tone) {
    return list(arr(items).map((it) => ({ title: it.text, tone, sub: itemsPreview(key, it), right: fixAction(key, it) })), { cls: 'p7-check' });
  }

  /* ── Home: Readiness (Commissioning) ─────────────────────────────────────────────────────────────────── */
  function toldLine(i) {
    const who = uniq(arr(i.told).filter((t) => t && t.role).map((t) => t.who));
    if (i.commissioning) return `Told the Leads by WhatsApp and in the app${who.length ? ` (${who.join(', ')})` : ''}; no call, no hooter.`;
    return who.length ? `Told ${who.join(', ')}.` : '';
  }
  function commIssues(key) {
    const open = arr(call(() => V().issues(key, { status: 'open' }), []));
    if (!open.length) return '';
    const band = (b) => U.bandName(b);
    if (open.length === 1) {
      const i = open[0];
      const head = i.commissioning && i.band === 'emergency' ? 'An Emergency during the trial opened an issue' : `An issue is open at ${band(i.band)}`;
      return banner(`<b>${esc(head)}:</b> ${esc(i.title)}, ${esc(fmt(i.opened))}. ${esc(toldLine(i))}`, { tone: i.band === 'emergency' ? 'bad' : 'warn', action: btn('Open the issue', { href: issueHref(key, i.id) }) });
    }
    const em = open.filter((i) => i.band === 'emergency').length;
    return banner(`<b>${pl(open.length, 'issue')} open${em ? `, ${em} at Emergency` : ''}:</b> ${esc(shortList(open.map((i) => `${i.title} (${band(i.band)})`), 3))}.`, { tone: em ? 'bad' : 'warn', action: btn('See the issues', { href: `${base(key)}/issues` }) });
  }
  function verdict(p, cl) {
    const nb = arr(cl.blockers).length; const ng = arr(cl.gaps).length;
    const gapText = ng ? `${pl(ng, 'gap')} ${ng === 1 ? 'remains' : 'remain'}, and gaps don't block` : 'no gaps either';
    if (nb) return `<p class="p7-verdict is-bad"><b>${esc(p.name)} can't go live yet:</b> ${pl(nb, 'blocker')} to clear first${ng ? `; ${pl(ng, 'gap')} that ${ng === 1 ? "doesn't" : "don't"} block` : ''}.</p>`;
    return `<p class="p7-verdict is-ok"><b>Nothing blocks go live.</b> ${cap(gapText)}.</p>`;
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function trackCard(o) {
    const complete = o.total > 0 && o.done >= o.total;
    const prog = `<div class="p7-prog">${U.progress(o.done, o.total)}<span>${complete ? '<b class="p7-done">Done</b> · ' : ''}${esc(o.progText)}</span></div>`;
    const lines = arr(o.lines).filter(Boolean).map((l) => `<li>${l}</li>`).join('');
    return card({ title: o.title, body: prog + (lines ? `<ul class="p7-lines">${lines}</ul>` : ''), foot: o.action || '', tone: complete ? 'ok' : null, cls: 'p7-track' });
  }
  function peopleLines(ppl) {
    const role = (r) => arr(ppl).filter((x) => r.includes(x.role));
    const say = (x) => `${esc(x.name)} <span class="muted">(${x.reachable ? esc(x.channel) : 'no verified phone: in the app only'})</span>`;
    const ops = role(['l1']); const leads = role(['l3', 'l4']);
    if (!ops.length && !leads.length) return ['Nobody is in the User Center for this plant yet.'];
    return [`${ops.length === 1 ? 'Operator' : 'Operators'}: ${ops.length ? ops.map(say).join(', ') : '<span class="tx-bad">none</span>'}`, `${leads.length === 1 ? 'Lead' : 'Leads'}: ${leads.length ? leads.map(say).join(', ') : '<span class="tx-bad">none</span>'}`];
  }
  function tracks(key, cl) {
    const v = V(); const b = base(key); const t = cl.tracks || {};
    const sr = call(() => v.scadaReview(key), { groups: [], typeDiffers: [], notInDb: [] });
    const nEq = arr(sr.groups).reduce((n, g) => n + (g.count || 0), 0);
    const sc = t.scada || { done: 0, total: 0 };
    const scadaCard = trackCard({
      title: 'What the plant graph has', done: sc.done, total: sc.total, progText: `${sc.done} of ${pl(sc.total, 'equipment type')} accepted`,
      lines: [`Read ${esc(fmt(sr.readAt))} · ${esc(pieces(nEq))}`,
        arr(sr.notInDb).length ? `<span class="tx-bad">${esc(pieces(sr.notInDb.length))} with a type the database doesn't have</span>` : '',
        arr(sr.typeDiffers).length ? `<span class="tx-warn">${esc(arr(sr.typeDiffers).length)} drawn as one type, stored as another</span>` : ''],
      action: sc.done < sc.total ? btn('Review what the plant graph found', { href: `${b}/scada`, kind: 'primary' }) : btn('Open', { href: `${b}/scada`, kind: 'ghost' }),
    });
    const lb = t.library || { done: 0, total: 0 };
    const trial = arr(call(() => v.alerts(key, { state: 'trial' }), [])).length;
    let blocked = 0; let np = 0; arr(lb.items).forEach((r) => arr(r.proposals).forEach((p) => { if (p.blockedBy) blocked++; if (p.nextPhase) np++; }));
    const libCard = trackCard({
      title: 'What the library brings', done: lb.done, total: lb.total, progText: `${lb.done} of ${pl(lb.total, 'proposal')} decided`,
      lines: [trial ? `${pl(trial, 'alert')} On trial` : 'No alert On trial yet', blocked ? `<span class="muted">${blocked} more can't be used yet: ${np === blocked ? 'they read a connection (next phase)' : np ? "they need a reading the plant graph doesn't send, or a connection (next phase)" : "they need a reading the plant graph doesn't send"}</span>` : ''],
      action: lb.done < lb.total ? btn(lb.next || 'Decide', { href: `${b}/library`, kind: 'primary' }) : btn('Open', { href: `${b}/library`, kind: 'ghost' }),
    });
    const pe = t.people || { done: 0, total: 2 };
    const peopleCard = trackCard({
      title: 'Who is told', done: pe.done, total: pe.total, progText: pe.done >= pe.total ? 'An Operator and a Lead can be reached' : pe.done ? 'One of Operator and Lead can be reached' : 'No Operator or Lead can be reached',
      lines: peopleLines(pe.items).concat(['<span class="muted">Read from the User Center; edited there, not here.</span>']),
      action: btn('Edit in the User Center', { act: 'p7:usercenter', kind: pe.done >= pe.total ? 'ghost' : 'secondary' }),
    });
    return `<div class="p7-tracks">${scadaCard}${libCard}${peopleCard}</div>`;
  }
  function goLiveFoot(key, cl) {
    if (cl.state === 'live') return '';
    if (cl.canGoLive) return btn('Go live', { act: 'p7:golive', data: { plant: key }, kind: 'primary' }) + '<span class="p7-foot-n">You see exactly what changes before anything does.</span>';
    /* v7: core's whyNot already says how many things block and which comes first */
    return btn('Go live', { kind: 'primary', disabled: true, title: cl.whyNot }) + `<span class="p7-why">${esc(cl.whyNot || 'Go live is blocked')}</span>`;
  }
  function beforeGoLive(key, cl) {
    const bl = arr(cl.blockers); const gp = arr(cl.gaps);
    const body = (bl.length ? `<h3 class="p7-h">Blocks go live</h3>${checkRows(key, bl, 'bad')}` : '<p class="p7-none">Nothing blocks go live.</p>')
      + (gp.length ? `<h3 class="p7-h">Gaps: they don't block</h3>${checkRows(key, gp, 'warn')}` : '');
    return card({ title: 'Before go live', sub: 'Blockers stop go live; gaps are worth fixing but never stop it. Each links to where it is fixed.', body, foot: goLiveFoot(key, cl), cls: 'p7-before' });
  }
  function trialRows(key) {
    const v = V();
    return arr(call(() => v.alerts(key, { state: 'trial' }), [])).map((a) => ({ a, ts: call(() => v.trialStats(key, a.id), null) })).filter((x) => x.ts)
      .sort((x, y) => (y.ts.perDay - x.ts.perDay) || String(x.a.name).localeCompare(String(y.a.name)));
  }
  /* v7: alerts are counted by when their trial started: those On trial for a day or more since the earliest start, and those accepted
     since (under a day, "just now" within the hour) on their own, so "13 alerts On trial since 23 Oct" never includes one accepted today */
  function trialSummary(key) {
    const rows = trialRows(key); if (!rows.length) return null;
    const young = (x) => isNum(x.ts.since) && now() - x.ts.since < DAY;
    const settled = rows.filter((x) => !young(x)); const fresh = rows.filter(young);
    const since = Math.min(...(settled.length ? settled : rows).map((x) => x.ts.since).filter(isNum));
    const firings = rows.reduce((n, x) => n + (x.ts.count || 0), 0);
    const noisy = rows.filter((x) => x.ts.noisy);
    const justNow = fresh.length && fresh.every((x) => now() - x.ts.since < 3600e3);
    const freshText = !fresh.length ? '' : `${fresh.length} ${justNow ? 'accepted just now' : `On trial for under a day`}`;
    const countText = settled.length && fresh.length ? `${pl(settled.length, 'alert')} On trial since ${fmt(since)}, and ${freshText}` : `${pl(rows.length, 'alert')} On trial since ${fmt(since)}`;
    return { rows, since, firings, noisy, alerts: rows.length, settled: settled.length, fresh: fresh.length, countText };
  }
  function looks(ts) {
    const out = [];
    if (arr(ts.firings).some((f) => f.band === 'emergency')) out.push(chip('Emergency: opened an issue', { tone: 'bad' }));
    if (ts.noisy) out.push(chip('Noisy', { tone: 'warn', title: 'More than 10 trial firings a day, averaged over the trial so far' }));
    if (ts.mostlyShort) out.push(chip('Mostly short', { tone: 'info', title: 'Most lasted 30 minutes or less and peaked within 10% of the limit' }));
    if (!ts.count) out.push('<span class="muted">Quiet</span>');
    return out.join(' ');
  }
  function trialCard(key) {
    const s = trialSummary(key); if (!s) return '';
    /* v7: an alert accepted moments ago has had no trial yet: it is not "quiet", it is untried, with how long it has been On trial */
    const young = (x) => isNum(x.ts.since) && now() - x.ts.since < DAY;
    const busy = s.rows.filter((x) => x.ts.count); const quiet = s.rows.filter((x) => !x.ts.count && !young(x)); const fresh = s.rows.filter((x) => !x.ts.count && young(x));
    /* v7: one colon, and no "On trial for 0 min" beside "no trial yet" */
    const justNow = fresh.every((x) => now() - x.ts.since < 3600e3);
    const freshLine = fresh.length ? `<p class="p7-quietline"><b>${justNow ? 'Just accepted, so no trial yet' : 'On trial for under a day, so too soon to tell'}</b>: ${fresh.map((x) => `<a href="${esc(alertHref(key, x.a.id))}">${esc(x.a.name)}</a>${justNow ? '' : ` <span class="muted">(${esc(minutes(Math.round((now() - x.ts.since) / 6e4)))})</span>`}`).join(' · ')}</p>` : '';
    const rows = busy.map((x) => {
      const f = arr(x.ts.firings); const last = f.length ? f[f.length - 1].start : null;
      return { _href: alertHref(key, x.a.id), alert: `<a href="${esc(alertHref(key, x.a.id))}">${esc(x.a.name)}</a><div class="p7-sub">${esc(x.a.sensorName || '')}${x.a.sensorTag ? ` · <span class="mono">${esc(x.a.sensorTag)}</span>` : ''}</div>`, perDay: `<b>${esc(rate(x.ts.perDay))}</b>`, count: String(x.ts.count || 0), looks: looks(x.ts), last: last ? fmt(last) : '—' };
    });
    const tbl = (rows.length ? table({ cols: [{ label: 'Alert', key: 'alert' }, { label: 'Trial firings a day', key: 'perDay', cls: 'num' }, { label: 'So far', key: 'count', cls: 'num' }, { label: 'What they look like', key: 'looks' }, { label: 'Last one', key: 'last', cls: 'nowrap' }], rows }) : '<p class="p7-none">No trial firings yet.</p>')
      + (quiet.length ? `<p class="p7-quietline"><b>${!rows.length ? 'Quiet so far' : quiet.length === 1 ? 'One more alert is quiet' : `${quiet.length} more alerts are quiet`}</b>${rows.length ? ', with no trial firings' : ''}: ${quiet.map((x) => `<a href="${esc(alertHref(key, x.a.id))}">${esc(x.a.name)}</a>`).join(' · ')}</p>` : '')
      + freshLine;
    const sub = `Since ${fmt(s.since)} · ${s.settled && s.fresh ? `${pl(s.settled, 'alert')} On trial, and ${s.fresh} ${justNow ? 'accepted just now' : 'for under a day'}` : `${pl(s.alerts, 'alert')} On trial`} · ${pl(s.firings, 'trial firing')}${s.noisy.length ? ` · ${s.noisy.length} noisy` : ''}. Below Emergency nothing was sent.`;
    const expl = '<p class="p7-expl">A trial firing is one would-be issue: it starts once the reading has been past a limit for its "must hold for" time and ends once it has been back inside for "must clear for". Noisy means more than 10 trial firings a day, averaged over the trial so far. Mostly short means most lasted 30 minutes or less and peaked within 10% of the limit.</p>';
    return card({ title: 'The trial so far', sub, body: tbl + expl, actions: [U.sampleTag()] });
  }
  function howCommissioning() {
    return note('During Commissioning, Caution, Minor and Major only record trial firings: nothing is sent and nothing reaches the operator app. On a new plant an Emergency is kept as a trial firing too. A plant that was Live keeps its Emergencies real. Calls, the hooter and tasks start at go live.', 'quiet');
  }
  function readiness(key) {
    const v = V(); const p = plantOf(key);
    const cl = call(() => v.checklist(key), null);
    if (!cl) return frame(key, 'home', note('The checklist could not be worked out for this plant.', 'bad'));
    const body = [
      part('Open issues', () => commIssues(key)),
      part('Readiness', () => verdict(p, cl)),
      part('The three tracks', () => tracks(key, cl)),
      part('Before go live', () => beforeGoLive(key, cl)),
      part('The trial so far', () => trialCard(key)),
      howCommissioning(),
    ].join('');
    return frame(key, 'home', body, { cls: 'p7-home' });
  }

  /* ── Home: Coverage (Live) ───────────────────────────────────────────────────────────────────────────── */
  const FOUND_BY = { visual: 'a visual check', manual: 'a manual test', lab: 'a lab test', report: 'a report', smell: 'a person noticing' };
  function openIssuesCard(key) {
    const v = V(); const open = arr(call(() => v.issues(key, { status: 'open' }), []));
    if (!open.length) return '';
    const label = (s) => ((v.LABELS && v.LABELS.issueStatus) || {})[s] || cap(s);
    const items = open.map((i) => ({
      title: i.title, href: issueHref(key, i.id), tone: i.band === 'emergency' || i.band === 'major' ? 'bad' : 'warn',
      chips: [U.sev(i.band), i.commissioning ? chip('Commissioning', { tone: 'muted' }) : ''],
      sub: `Opened ${fmt(i.opened)} · ${label(i.status)}${i.causedBy ? ` · caused by ${tagOf(key, i.causedBy)}` : ''}`,
      right: `<a class="p7-fix" href="${esc(issueHref(key, i.id))}">Open →</a>`,
    }));
    return card({ title: open.length === 1 ? 'One open issue' : `${open.length} open issues`, body: list(items, { cls: 'p7-check' }), actions: [btn('All issues', { href: `${base(key)}/issues`, kind: 'ghost' })] });
  }
  function alertsCard(key, c) {
    const t = c.totals || {};
    const recent = isNum(c.since) && now() - c.since < 30 * DAY;
    const sub = `${recent ? `Since go live, ${fmtDay(c.since)}` : 'Last 30 days'}. Issues opened during Commissioning are left out of the rates.`;
    /* v7: an issue still open from Commissioning (e.g. its Emergency) is counted as open, and the tile says so */
    const openComm = arr(call(() => V().issues(key, { status: 'open', commissioning: true }), [])).length;
    const st = stats([
      { value: rate(t.firesPerDay), label: 'issues a day from alerts' },
      { value: pct(t.falseAlarmShare), label: 'closed as false alarms' },
      { value: minutes(isNum(t.medianCloseMin) ? t.medianCloseMin : isNum(t.medianCloseH) ? t.medianCloseH * 60 : null), label: 'median time to close' },
      { value: String(t.openIssues || 0), label: openComm ? (openComm === t.openIssues ? 'open now, from Commissioning' : `open now, ${openComm} from Commissioning`) : 'open now', tone: t.openIssues ? 'warn' : null },
      { value: String(t.blindSpots || 0), label: 'blind spots', tone: t.blindWithoutTask ? 'warn' : null },
    ]);
    const busy = arr(c.alerts).filter((a) => a.issues); const quiet = arr(c.alerts).filter((a) => !a.issues);
    const rows = busy.map((a) => ({
      _href: alertHref(key, a.alertId),
      name: `<a href="${esc(alertHref(key, a.alertId))}">${esc(a.name)}</a>${a.state && a.state !== 'on' ? ' ' + U.stateChip(a.state) : ''}`,
      issues: String(a.issues || 0), perDay: rate(a.firesPerDay), fa: pct(a.falseAlarmShare), close: minutes(isNum(a.medianCloseMin) ? a.medianCloseMin : isNum(a.medianCloseH) ? a.medianCloseH * 60 : null),
    }));
    const tbl = (rows.length ? table({ cols: [{ label: 'Alert', key: 'name' }, { label: 'Issues', key: 'issues', cls: 'num' }, { label: 'A day', key: 'perDay', cls: 'num' }, { label: 'False alarms', key: 'fa', cls: 'num' }, { label: 'Time to close', key: 'close', cls: 'num' }], rows })
        : `<p class="p7-none">${arr(c.alerts).length ? `No alert has opened an issue ${recent ? 'since go live' : 'in the last 30 days'}.` : 'No alert is On at this plant.'}</p>`)
      + (quiet.length && rows.length ? `<p class="p7-quietline"><b>${quiet.length === 1 ? 'One more alert' : `${quiet.length} more alerts`} opened no issues</b>: ${quiet.map((a) => `<a href="${esc(alertHref(key, a.alertId))}">${esc(a.name)}</a>`).join(' · ')}</p>`
        : quiet.length ? `<p class="p7-quietline"><b>${quiet.length === 1 ? 'One alert is' : `${quiet.length} alerts are`} ${quiet.every((a) => !a.state || a.state === 'on') ? 'On and quiet' : 'quiet'}</b>: ${quiet.map((a) => `<a href="${esc(alertHref(key, a.alertId))}">${esc(a.name)}</a>${a.state && a.state !== 'on' ? ' ' + U.stateChip(a.state) : ''}`).join(' · ')}</p>` : '');
    return card({ title: 'How the alerts are doing', sub, body: st + `<div class="p7-gap"></div>` + tbl, actions: [U.sampleTag()] });
  }
  /* v7: "Add the task" opens What the library brings at the equipment whose proposal it is, not the whole list */
  function proposalHref(key, homeTypes, taskName) {
    const rows = arr(call(() => V().libraryReview(key), [])); const types = arr(homeTypes);
    const r = rows.find((x) => types.includes(x.typeName) && arr(x.proposals).some((p) => p.name === taskName && !p.blockedBy && p.decided !== 'accepted'))
      || rows.find((x) => types.includes(x.typeName));
    return r && r.eqId !== 'plant' ? `${base(key)}/library?show=all&eq=${enc(r.eqId)}` : `${base(key)}/library?show=all`;
  }
  function blindCard(key, c) {
    const bs = arr(c.blindSpots).slice().sort((a, b) => (a.hasTask === b.hasTask ? 0 : a.hasTask ? 1 : -1));
    if (!bs.length) return card({ title: 'Blind spots', body: note('Every issue this plant\'s equipment can have is caught by an alert here.', 'ok') });
    const types = new Set(arr(call(() => V().equipment(key), [])).map((e) => e.typeName));
    const items = bs.map((x) => {
      const on = arr(x.homeTypes).filter((t) => types.has(t));
      const how = arr(x.foundBy).map((k) => FOUND_BY[k] || k);
      const right = x.hasTask && x.taskId ? `<a class="p7-fix p7-wrap" href="${esc(taskHref(key, x.taskId))}">${esc(x.taskName || 'The task')} →</a>`
        : x.taskName ? `<a class="p7-fix" href="${esc(proposalHref(key, on, x.taskName))}">Add the task →</a>` : chip('No task looks for it', { tone: 'warn' });
      const sub = `${how.length ? `Found by ${how.join(' or ')}` : 'Found by a person'}${on.length ? ` · on ${on.join(', ')}` : ''}${!x.hasTask ? (x.taskName ? ` · no task looks for it yet; the library has "${x.taskName}"` : ' · no task in the library looks for it') : ''}`;
      return { title: x.name, chips: [x.homeToConfirm ? chip('Where it belongs: to confirm', { tone: 'muted', title: 'Found by a report or a lab test; which equipment it belongs to is still to confirm' }) : ''], sub, right, tone: x.hasTask ? null : 'warn' };
    });
    const without = bs.filter((x) => !x.hasTask).length;
    /* v7: attention first: the top 3, the rest folded */
    const TOP = 3; const head = list(items.slice(0, TOP), { cls: 'p7-check' });
    const rest = items.length > TOP ? `<details class="p7-more-d"><summary>and ${items.length - TOP} more</summary>${list(items.slice(TOP), { cls: 'p7-check' })}</details>` : '';
    return card({ title: 'Blind spots', sub: `Issues this plant's equipment can have that no alert here catches: only a person finds them. ${without ? `${without} of ${bs.length} ${without === 1 ? 'has' : 'have'} no task that looks for ${without === 1 ? 'it' : 'them'}.` : 'Each has a task that looks for it.'}`, body: head + rest });
  }
  function gapsCard(key, cl) {
    const bl = arr(cl.blockers); const gp = arr(cl.gaps);
    if (!bl.length && !gp.length) return card({ title: 'Gaps the plant runs with', body: note('The checklist finds no gaps at this plant.', 'ok') });
    return card({ title: 'Gaps the plant runs with', sub: 'The same checklist as Readiness. None of these stop the plant; each links to where it is fixed.', body: (bl.length ? checkRows(key, bl, 'bad') : '') + (gp.length ? checkRows(key, gp, 'warn') : '') });
  }
  function diffsCard(key) {
    const ov = arr(call(() => V().overrides({ plant: key }), []));
    if (!ov.length) return '';
    const n = (f) => ov.filter(f).length;
    const bits = [[n((o) => o.state === 'libchanged'), 'Library changed since'], [n((o) => o.state === 'review'), 'Review due'], [n((o) => o.reason === 'unrecorded'), 'reason not recorded'], [n((o) => o.reason === 'notinlib'), 'not in the library']]
      .filter((x) => x[0]).map((x) => `${x[0]} ${x[1]}`);
    return card({ title: `${pl(ov.length, 'difference')} from the library`, sub: bits.length ? bits.join(' · ') : 'Each one has a reason and a review date.', actions: [btn('See the differences', { href: `${base(key)}/differences` })], cls: 'p7-compact' });
  }
  function changesCard(key, c) {
    const ch = arr(c.changes); if (!ch.length) return '';
    const items = ch.slice().sort((a, b) => b.at - a.at).map((x) => ({
      title: `<a href="${esc(libHref(x.code))}">${esc(x.typeName)}</a> · version ${esc(x.version)}`, chips: [x.kind === 'safety' ? chip('Safety change', { tone: 'bad' }) : ''],
      sub: `${x.text}${x.note ? ` — ${x.note}` : ''}`, right: fmtDay(x.at),
    }));
    return card({ title: 'Library changes that reached this plant', sub: 'Dated notes from each publish. Nothing was pushed to anyone\'s phone.', body: list(items) });
  }
  function reviewsCard(key) {
    const v = V(); const cl = call(() => v.checklist(key), null); if (!cl || !cl.tracks) return '';
    const lb = cl.tracks.library || {}; const sc = cl.tracks.scada || {};
    const und = (lb.total || 0) - (lb.done || 0); const scLeft = (sc.total || 0) - (sc.done || 0);
    if (!und && !scLeft) return '';
    const bits = [scLeft ? `${pl(scLeft, 'equipment type')} the plant graph found ${scLeft === 1 ? 'is' : 'are'} not accepted yet` : '', und ? `${pl(und, 'library proposal')} ${und === 1 ? 'is' : 'are'} not decided yet; alerts accepted now run On trial for 7 days before they reach people` : ''].filter(Boolean);
    const b = base(key);
    return card({ title: 'Still to review', sub: cap(bits.join('. ')) + '.', actions: [und ? btn('What the library brings', { href: `${b}/library` }) : btn('What the plant graph has', { href: `${b}/scada` })], tone: 'quiet', cls: 'p7-compact' });
  }
  function returnCard(key) {
    return card({ title: 'Return to Commissioning', sub: 'For a rebuild or a long shutdown. Alerts go back On trial and tasks stop until the plant goes live again. Emergencies are still sent to the Leads.', actions: [btn('Return to Commissioning…', { act: 'p7:return', data: { plant: key }, kind: 'danger' })], tone: 'quiet', cls: 'p7-compact' });
  }
  function coverage(key) {
    const v = V(); const p = plantOf(key);
    const c = call(() => v.coverage(key), null); const cl = call(() => v.checklist(key), { blockers: [], gaps: [] });
    if (!c) return frame(key, 'home', note('Coverage could not be worked out for this plant.', 'bad'));
    const fresh = isNum(p.since) && now() - p.since < DAY && now() >= p.since;
    const body = [
      fresh ? banner(`<b>${esc(p.name)} went live ${esc(fmt(p.since))}.</b> Alerts reach people and tasks have started. Counts start at go live, so this page fills in over the next days.`, { tone: 'ok' }) : '',
      part('Open issues', () => openIssuesCard(key)),
      part('How the alerts are doing', () => alertsCard(key, c)),
      part('Gaps', () => gapsCard(key, cl)),
      part('Differences', () => diffsCard(key)),
      part('Blind spots', () => blindCard(key, c)),
      part('Library changes', () => changesCard(key, c)),
      part('Still to review', () => reviewsCard(key)),
      returnCard(key),
    ].join('');
    return frame(key, 'home', body, { cls: 'p7-home' });
  }
  function home(params) { return guard(params, (key) => (V().state(key) === 'live' ? coverage(key) : readiness(key))); }

  /* ── What the plant graph has ─────────────────────────────────────────────────────────────────────────────────── */
  function formText(form) {
    if (!form || typeof form !== 'object') return '';
    if (U.formAnswers) return esc(shortList(U.formAnswers(form), 3));   /* v7: plain labels and units, the same as the equipment page */
    const ks = Object.keys(form).filter((k) => form[k] != null && form[k] !== '');
    return shortList(ks.map((k) => `${k} ${form[k]}`), 3);
  }
  function scadaGroup(key, g, open) {
    const tags = arr(g.equipment).map((e) => e.tag);
    const nRead = arr(g.equipment).reduce((n, e) => n + (e.readings || 0), 0);
    const differs = arr(g.equipment).filter((e) => e.typeDiffers).length;
    const right = g.accepted ? chip(`Accepted ${fmtDay(g.acceptedAt)}`, { tone: 'ok' }) : !g.inDb ? chip('Not in the database', { tone: 'bad' }) : btn('Accept', { act: 'p7:scada-accept', data: { plant: key, type: g.typeName }, small: true, title: `Accept ${countType(g.count, g.typeName)}` });
    const rows = arr(g.equipment).map((e) => ({
      _href: eqHref(key, e.eqId),
      tag: `<a class="mono" href="${esc(eqHref(key, e.eqId))}">${esc(e.tag)}</a>`, name: e.name,
      drawn: e.typeDiffers ? chip(`Drawn as ${e.drawn}`, { tone: 'warn', title: `Stored as ${e.stored}: fix the drawing in the plant graph` }) : `<span class="muted">${esc(e.drawn || g.typeName)}</span>`,
      readings: `${e.readings || 0}${e.nextPhaseReadings ? ` <span class="muted">+ ${e.nextPhaseReadings} next phase</span>` : ''}`,
      form: e.form ? formText(e.form) : '<span class="muted">—</span>',
    }));
    const tbl = table({ cols: [{ label: 'Tag', key: 'tag' }, { label: 'Name', key: 'name' }, { label: 'Drawn as', key: 'drawn' }, { label: 'Readings', key: 'readings' }, { label: 'plant graph', key: 'form' }], rows });
    const sum = `<summary><span class="p7-sum-main"><span class="p7-sum-t">${esc(g.typeName)} <span class="muted">· ${esc(g.count)}</span></span><span class="p7-sum-s">${esc(shortList(tags, 6))} · ${pl(nRead, 'reading')}${differs ? ` · <span class="tx-warn">${differs} drawn as another type</span>` : ''}</span></span><span class="p7-sum-r">${right}</span></summary>`;
    return `<details class="p7-grp"${open ? ' open' : ''}>${sum}<div class="p7-grp-b">${tbl}${g.code ? `<p class="p7-more"><a href="${esc(libHref(g.code))}">${esc(g.typeName)} in the library →</a></p>` : ''}</div></details>`;
  }
  function scada(params) {
    return guard(params, (key, q) => {
      const v = V(); const b = base(key); const live = v.state(key) === 'live';
      const sr = call(() => v.scadaReview(key), null);
      if (!sr) return frame(key, 'home', note('What the plant graph has could not be read.', 'bad'), { crumbs: [{ label: 'What the plant graph has' }] });
      const groups = arr(sr.groups); const left = groups.filter((g) => !g.accepted);
      const nEq = groups.reduce((n, g) => n + (g.count || 0), 0); const nRead = groups.reduce((n, g) => n + arr(g.equipment).reduce((m, e) => m + (e.readings || 0), 0), 0);
      const nNext = arr(sr.nextPhase).length;
      const parts = [];
      const sub = `Read from the plant graph ${fmt(sr.readAt)}: ${pieces(nEq)} of ${pl(groups.length, 'database type')}, with ${pl(nRead, 'reading')}${nNext ? `, plus ${nNext} on pipes between equipment (next phase)` : ''}. The plant graph is the only source of equipment, readings and answers: when something is wrong, fix it in the plant graph, then read again.`;
      if (arr(sr.notInDb).length) {
        const items = sr.notInDb.map((e) => ({ title: `<span class="mono">${esc(e.tag)}</span> ${esc(e.name)}`, sub: `Stored as "${e.stored || e.code || 'nothing'}", which the database doesn't have`, tone: 'bad' }));
        parts.push(card({ title: `${pieces(sr.notInDb.length)} with a type the database doesn't have`, sub: 'This blocks go live. Give each one a database type in the plant graph, then read again.', body: list(items), actions: [btn('Fix it in the plant graph', { act: 'p7:scada-fix', kind: 'primary' })], tone: 'bad' }));
      }
      if (arr(sr.typeDiffers).length) {
        const items = sr.typeDiffers.map((e) => ({ title: `<a class="mono" href="${esc(eqHref(key, e.eqId))}">${esc(e.tag)}</a> ${esc(e.name)}`, sub: `Drawn as <b>${esc(e.drawn)}</b>, stored as <b>${esc(e.stored)}</b>. The stored type is the one used.`, tone: 'warn' }));
        parts.push(card({ title: `${pieces(sr.typeDiffers.length)} drawn as one type and stored as another`, sub: 'A gap, not a blocker: limits, alerts and tasks follow the stored type. Fix the drawing in the plant graph, then read again.', body: list(items), actions: [btn('Fix it in the plant graph', { act: 'p7:scada-fix' })], tone: 'warn' }));
      }
      if (!left.length && groups.length && !live) {
        const lr = call(() => v.checklist(key), null); const lb = lr && lr.tracks && lr.tracks.library;
        parts.push(banner(`<b>Everything the plant graph found is accepted.</b>${lb && lb.done < lb.total ? ' Next: decide what the library brings for each piece of equipment.' : ''}`, { tone: 'ok', action: lb && lb.done < lb.total ? btn('What the library brings', { href: `${b}/library`, kind: 'primary' }) : btn('Back to Readiness', { href: b }) }));
      }
      const few = groups.length <= 4;
      parts.push(card({
        title: 'Equipment by database type',
        sub: left.length ? `${left.length} of ${pl(groups.length, 'type')} to accept. Open a type to check its equipment, then accept it.` : `All ${pl(groups.length, 'type')} accepted.`,
        actions: [left.length ? btn(left.length === groups.length ? `Accept all ${left.length} types` : `Accept the other ${left.length}`, { act: 'p7:scada-accept-all', data: { plant: key }, kind: 'primary' }) : ''],
        body: groups.length ? groups.map((g) => scadaGroup(key, g, few || q.type === g.typeName)).join('') : empty('the plant graph sent no equipment for this plant.'),
      }));
      if (arr(sr.nextPhase).length) {
        parts.push(note(`<b>Next phase:</b> readings on pipes between equipment are not used yet. The plant graph sends ${pl(sr.nextPhase.length, 'of them', 'of them')}: ${esc(shortList(sr.nextPhase.map((s) => `${s.name}${s.tag ? ` (${s.tag})` : ''}${s.eqTag ? ` near ${s.eqTag}` : ''}`), 5))}.`, 'next'));
      }
      return frame(key, 'home', parts.join(''), { crumbs: [{ label: 'What the plant graph has' }], title: 'What the plant graph has', sub });
    });
  }

  /* ── What the library brings ──────────────────────────────────────────────────────────────────────────── */
  const SHOWS = ['undecided', 'decided', 'blocked', 'all'];
  function propKind(p) { return p.kind === 'alert' ? chip('Alert', { tone: 'info' }) : p.kindLabel ? chip(p.kindLabel, { tone: 'muted', title: 'Set by a plant graph answer, not a task' }) : chip('Task', { tone: 'muted' }); }
  function propDetail(p) {
    if (p.kind === 'alert' && p.limits && p.limits.perBand) {
      const pbs = Object.keys(p.limits.perBand).map((k) => p.limits.perBand[k]).filter((x) => x && x.value != null);
      const seen = {}; const chips = pbs.filter((x) => { const t = x.chipText; if (seen[t]) return false; seen[t] = 1; return true; }).map((x) => U.sourceChip(x));
      return `${esc(p.detail || 'No limits yet')} ${chips.join(' ')}`;
    }
    if (p.blockedBy) return `<span class="muted">${esc(p.detail || '')}</span>`;
    return `${esc(p.detail || '')}${p.detail ? ' ' + chip('Follows the library', { tone: 'lib' }) : ''}`;
  }
  function propRow(key, p, alertIds) {
    const d = { plant: key, pid: p.pid };
    let right; let cls = 'p7-prop';
    if (p.blockedBy) { cls += ' is-blocked'; right = p.nextPhase ? chip('Next phase', { tone: 'next', title: 'Reads a connection between equipment: next phase' }) : `<span class="p7-blocked">${esc(p.blockedBy)}</span>`; }
    else if (p.decided === 'accepted') {
      const id = p.kind === 'alert' ? alertIds[`${p.name} — ${p.tag}`] : null; const st = id ? call(() => V().alertState(key, id), null) : null;
      right = `${st ? (id ? `<a href="${esc(alertHref(key, id))}">${U.stateChip(st)}</a>` : U.stateChip(st)) : chip('Accepted', { tone: 'ok' })}${btn('Not for this plant', { act: 'p7:lib-reject', data: d, small: true, kind: 'ghost' })}`;
    } else if (p.decided === 'rejected') {
      right = `${chip('Not for this plant', { tone: 'muted', title: p.reason || '' })}${btn('Accept after all', { act: 'p7:lib-accept', data: d, small: true, kind: 'ghost' })}`;
    } else {
      right = btn('Accept', { act: 'p7:lib-accept', data: d, small: true, title: p.kind === 'alert' ? 'It goes On trial: trial firings are recorded, nothing is sent' : 'It starts at go live' }) + btn('Not for this plant', { act: 'p7:lib-reject', data: d, small: true, kind: 'ghost' });
    }
    const why = p.decided === 'rejected' && p.reason ? `<div class="p7-prop-w">Why: ${esc(p.reason)}</div>` : '';
    return `<li class="${cls}"><div class="p7-prop-k">${propKind(p)}</div><div class="p7-prop-m"><div class="p7-prop-n">${esc(p.name)}</div><div class="p7-prop-d">${propDetail(p)}</div>${why}</div><div class="p7-prop-a">${right}</div></li>`;
  }
  /* v7 (card D22): routine checks, routine work and manual tests are one task per type at the plant (the Tasks tab's rule), so the
     review lists each once per type, naming its equipment; one line is accepted or left out for all of them, and opening it lets
     one piece of equipment be left out with a reason */
  const SHARED_WORK = ['routine', 'work', 'test'];
  const isShared = (p) => p.kind === 'task' && p.eqId !== 'plant' && SHARED_WORK.includes(p.workType);
  function sharedGroups(rows) {
    const m = new Map();
    rows.forEach((r) => arr(r.proposals).filter(isShared).forEach((x) => { const k = x.name; if (!m.has(k)) m.set(k, { name: x.name, typeName: r.typeName, workType: x.workType, props: [] }); m.get(k).props.push({ ...x, tag: x.tag || r.tag, eqName: r.name }); }));
    return [...m.values()];
  }
  const groupState = (g) => { const live = g.props.filter((x) => !x.blockedBy); return { und: live.filter((x) => !x.decided).length, acc: live.filter((x) => x.decided === 'accepted').length, rej: live.filter((x) => x.decided === 'rejected').length, blocked: g.props.length - live.length, n: g.props.length }; };
  /* lines to decide: a shared task counts once for its type; everything else once per piece of equipment */
  function lineCounts(rows) {
    const c = { undecided: 0, tasks: 0, alerts: 0, all: 0 };
    const byType = new Map(); rows.forEach((r) => { if (!byType.has(r.typeName)) byType.set(r.typeName, []); byType.get(r.typeName).push(r); });
    byType.forEach((rs) => {
      sharedGroups(rs).forEach((g) => { const st = groupState(g); c.all++; if (st.und) { c.undecided++; c.tasks++; } });
      rs.forEach((r) => arr(r.proposals).filter((x) => !isShared(x)).forEach((x) => { c.all++; if (!x.decided && !x.blockedBy) { c.undecided++; if (x.kind === 'alert') c.alerts++; else c.tasks++; } }));
    });
    return c;
  }
  function sharedBlock(key, g, show, open, alertIds) {
    const st = groupState(g);
    if (show === 'undecided' && !st.und) return ''; if (show === 'decided' && !(st.acc + st.rej)) return ''; if (show === 'blocked' && !st.blocked) return '';
    const pids = g.props.filter((x) => !x.decided && !x.blockedBy).map((x) => x.pid).join(',');
    const status = [st.und ? `<b>${st.und} to decide</b>` : '', st.acc ? `${st.acc} accepted` : '', st.rej ? `${st.rej} left out` : '', st.blocked ? `${st.blocked} can't be used yet` : ''].filter(Boolean).join(' · ');
    const acts = st.und ? btn(st.und === 1 ? 'Accept' : `Accept for all ${st.und}`, { act: 'p7:lib-accept-group', data: { plant: key, pids }, small: true, title: 'One task for the type at this plant, with a line per piece of equipment' }) + btn('Not for this plant', { act: 'p7:lib-reject-group', data: { plant: key, pids, name: g.name }, small: true, kind: 'ghost' }) : '';
    const label = `<span class="p7-sum-t">${esc(g.name)} <span class="muted">· ${esc(countType(g.props.length, g.typeName))}</span></span>`;
    const sum = `<summary><span class="p7-sum-main">${label}<span class="p7-sum-s">${esc(C_WT(g.workType))} · ${status}</span></span><span class="p7-sum-r">${acts}</span></summary>`;
    return `<details class="p7-grp p7-shared"${open ? ' open' : ''}>${sum}<div class="p7-grp-b"><p class="p7-more">One task for the type at this plant, with a line per piece of equipment. Leave one out below, with a reason.</p><ul class="p7-props">${g.props.map((x) => propRow(key, { ...x, name: `${x.tag}${x.eqName ? ' ' + x.eqName : ''}` }, alertIds)).join('')}</ul></div></details>`;
  }
  const C_WT = (w) => ({ routine: 'Routine check', work: 'Routine work', test: 'Manual testing' }[w] || 'Task');
  /* v7/3: what this plant inherits from the library, what it could but does not, and why */
  function inheritCard(key, lr, c, qs) {
    const all = [].concat(...lr.map((r) => arr(r.proposals).map((x) => ({ ...x, tag: x.tag || r.tag })))); const p = plantOf(key);
    const needs = {}; let next = 0; all.filter((x) => x.blockedBy).forEach((x) => { if (x.nextPhase) { next++; return; } const m = /Needs an? (.+?) reading/.exec(x.blockedBy); const k = m ? m[1] : x.blockedBy; needs[k] = (needs[k] || 0) + 1; });
    const left = all.filter((x) => x.decided === 'rejected'); const whyLeft = {}; left.forEach((x) => { const k = x.reason || 'No reason given'; whyLeft[k] = (whyLeft[k] || 0) + 1; });
    const needList = Object.entries(needs).sort((a, b) => b[1] - a[1]);
    const row = (n, label, why, href, tone) => `<li class="inh${tone ? ' inh-' + tone : ''}"><b>${n}</b><div><span class="inh-l">${label}</span>${why ? `<span class="inh-w">${why}</span>` : ''}</div>${href && n ? `<a href="${esc(href)}">See them</a>` : ''}</li>`;
    const rows = [
      row(c.accepted || 0, 'Inherited', 'Accepted here; they follow the library until someone changes a value.', qs('decided'), 'ok'),
      row(c.undecided, 'Could be inherited: waiting for a decision', c.undecided ? 'Nobody has accepted them or left them out yet.' : '', qs('undecided'), c.undecided ? 'warn' : ''),
      row(needList.reduce((s, x) => s + x[1], 0), 'Not inherited: the reading is missing', needList.length ? `The plant graph has no ${esc(needList.slice(0, 6).map(([k, n]) => `${k} (${n})`).join(', '))}${needList.length > 6 ? ` and ${needList.length - 6} more` : ''} reading on that equipment. Add the sensor in the plant graph and they can be accepted.` : '', qs('blocked'), ''),
      row(next, 'Not inherited: reads a connection between equipment', next ? 'This phase reads sensors on the equipment only. These arrive in the next phase.' : '', qs('blocked'), ''),
      row(left.length, 'Not inherited: left out at this plant', left.length ? esc(Object.entries(whyLeft).slice(0, 4).map(([k, n]) => `“${k}” (${n})`).join(', ')) : 'Nothing has been left out on purpose.', qs('decided'), ''),
    ];
    return card({ title: `What ${p ? p.name : 'this plant'} inherits from the library`, sub: 'Every alert and task the library has for this plant\'s equipment, by what happened to it. Nothing is inherited without its reading.', body: `<ul class="inh-list">${rows.join('')}</ul>` });
  }
  function libCounts(rows) {
    const c = { undecided: 0, decided: 0, accepted: 0, rejected: 0, blocked: 0, all: 0 };
    rows.forEach((r) => arr(r.proposals).forEach((p) => { c.all++; if (p.blockedBy) c.blocked++; else if (p.decided) { c.decided++; c[p.decided] = (c[p.decided] || 0) + 1; } else c.undecided++; }));
    return c;
  }
  function visibleProps(r, show) {
    const ps = arr(r.proposals).filter((p) => !isShared(p));
    if (show === 'undecided') { const und = ps.filter((p) => !p.decided && !p.blockedBy); return und.length ? und.concat(ps.filter((p) => p.blockedBy)) : []; }
    if (show === 'decided') return ps.filter((p) => p.decided && !p.blockedBy);
    if (show === 'blocked') return ps.filter((p) => p.blockedBy);
    return ps;
  }
  function eqStatus(r) {
    const c = libCounts([r]);
    return [c.undecided ? `<b>${c.undecided} to decide</b>` : '', c.accepted ? `${c.accepted} accepted` : '', c.rejected ? `${c.rejected} not for this plant` : '', c.blocked ? `${c.blocked} can't be used yet` : ''].filter(Boolean).join(' · ') || 'Nothing proposed';
  }
  function eqBlock(key, r, show, open, alertIds) {
    const ps = visibleProps(r, show); if (!ps.length) return '';
    const und = arr(r.proposals).filter((p) => !p.decided && !p.blockedBy).length;
    const label = r.eqId === 'plant' ? '<span class="p7-sum-t">The plant itself</span>' : `<span class="p7-sum-t"><span class="mono">${esc(r.tag)}</span> ${esc(r.name || '')}</span>`;
    const act = und > 1 ? btn(`Accept these ${und}`, { act: 'p7:lib-accept-eq', data: { plant: key, eq: r.eqId }, small: true, title: `Accept the ${und} undecided for ${r.eqId === 'plant' ? 'the plant' : r.tag}` }) : '';
    const sum = `<summary><span class="p7-sum-main">${label}<span class="p7-sum-s">${eqStatus(r)}</span></span><span class="p7-sum-r">${act}</span></summary>`;
    const link = r.eqId !== 'plant' ? `<p class="p7-more"><a href="${esc(eqHref(key, r.eqId))}">Open ${esc(r.tag)} →</a></p>` : '';
    return `<details class="p7-grp p7-eq"${open ? ' open' : ''}>${sum}<div class="p7-grp-b"><ul class="p7-props">${ps.map((p) => propRow(key, p, alertIds)).join('')}</ul>${link}</div></details>`;
  }
  function library(params) {
    return guard(params, (key, q) => {
      const v = V(); const b = base(key); const live = v.state(key) === 'live'; const p = plantOf(key);
      const lr = arr(call(() => v.libraryReview(key), []));
      const c = libCounts(lr); const lc = lineCounts(lr);
      const show = SHOWS.includes(q.show) ? q.show : c.undecided ? 'undecided' : 'all';
      const qs = (s) => `${b}/library?show=${s}`;
      const alertIds = {}; arr(call(() => v.alerts(key), [])).forEach((a) => { alertIds[a.name] = a.id; });
      const trial = arr(call(() => v.alerts(key, { state: 'trial' }), [])).length;
      const parts = [];
      const sub = live
        ? `${p.name} is Live. For each piece of equipment the library proposes alerts and tasks; alerts you accept now run On trial for 7 days before they reach people.`
        : 'For each piece of equipment the library proposes alerts and tasks, each limit with a chip saying where it comes from. Accepted alerts go On trial: trial firings are recorded, nothing is sent until go live.';
      parts.push(inheritCard(key, lr, c, qs));
      const undEq = lr.filter((r) => arr(r.proposals).some((x) => !x.decided && !x.blockedBy)).length;
      const summary = stats([
        { value: String(lc.undecided), label: `to decide (${pl(lc.tasks, 'task')}, ${pl(lc.alerts, 'alert')})`, tone: lc.undecided ? 'warn' : null },
        { value: String(c.accepted || 0), label: `accepted${trial ? ` · ${trial} alerts On trial` : ''}` },
        { value: String(c.rejected || 0), label: 'not for this plant' },
        { value: String(c.blocked), label: "can't be used yet" },
      ]);
      parts.push(card({
        title: c.undecided ? `${pl(lc.undecided, 'line')} to decide (${pl(lc.tasks, 'task')}, ${pl(lc.alerts, 'alert')})` : 'Every proposal is decided',
        sub: c.undecided ? `${undEq > 1 ? 'Accept a whole type at once, or open a piece of equipment to decide one by one.' : 'Decide it below.'} A routine check, routine work or manual test shared by a type is one line, as on the Tasks tab${c.undecided !== lc.undecided ? `: ${c.undecided} proposals in all` : ''}.` : `${trial ? `${pl(trial, 'alert')} ${trial === 1 ? 'is' : 'are'} On trial. ` : ''}You can still change any decision below.`,
        body: summary,
        actions: [c.undecided && undEq > 1 ? btn(`Accept all ${lc.undecided}`, { act: 'p7:lib-accept-all', data: { plant: key }, kind: 'primary' }) : !c.undecided && !live ? btn('Back to Readiness', { href: b, kind: call(() => v.checklist(key).canGoLive, false) ? 'primary' : 'secondary' }) : ''],
        tone: c.undecided ? null : 'ok',
      }));
      parts.push(filters([
        { label: 'To decide', href: qs('undecided'), on: show === 'undecided', count: lc.undecided },
        { label: 'Decided', href: qs('decided'), on: show === 'decided', count: c.decided },
        { label: "Can't be used yet", href: qs('blocked'), on: show === 'blocked', count: c.blocked },
        { label: 'All', href: qs('all'), on: show === 'all', count: lc.all },
      ]));
      /* group equipment rows by stored type, in the order the plant graph groups them; the plant itself last */
      const order = arr(call(() => v.scadaReview(key).groups, [])).map((g) => g.typeName);
      const byType = new Map(); order.forEach((t) => byType.set(t, []));
      let plantRow = null;
      lr.forEach((r) => { if (r.eqId === 'plant') { plantRow = r; return; } if (!byType.has(r.typeName)) byType.set(r.typeName, []); byType.get(r.typeName).push(r); });
      const visibleEq = lr.filter((r) => visibleProps(r, show).length).length;
      const openAll = !!q.eq ? false : (show === 'undecided' && c.undecided <= 20) || visibleEq <= 3;
      const isOpen = (r) => (q.eq ? r.eqId === q.eq : openAll);
      const cards = [];
      byType.forEach((rows, typeName) => {
        const shared = sharedGroups(rows).map((g) => sharedBlock(key, g, show, false, alertIds)).filter(Boolean);
        const blocks = rows.map((r) => eqBlock(key, r, show, isOpen(r), alertIds)).filter(Boolean);
        if (!blocks.length && !shared.length) return;
        const tc = libCounts(rows); const undRows = rows.filter((r) => arr(r.proposals).some((x) => !x.decided && !x.blockedBy)).length; const code = (rows[0] && call(() => v.eq(key, rows[0].eqId).dbType, null)) || null;
        const undNames = uniq([].concat(...rows.map((r) => arr(r.proposals).filter((x) => !x.decided && !x.blockedBy).map((x) => x.name))));
        const sub = `${pieces(rows.length)}${tc.undecided ? ` · ${tc.undecided} to decide` : ' · all decided'}${tc.blocked ? ` · ${tc.blocked} can't be used yet` : ''}${undNames.length && show !== 'decided' ? `. To decide: ${shortList(undNames, 3)}` : ''}`;
        cards.push(card({
          title: code ? `<a href="${esc(libHref(code))}">${esc(typeName)}</a>` : typeName, sub, body: (shared.length ? `<h4 class="p7-shared-h">Shared by the type · one line each</h4>${shared.join('')}` : '') + (shared.length && blocks.length ? '<h4 class="p7-shared-h">On each piece of equipment</h4>' : '') + blocks.join(''),
          actions: [undRows > 1 ? btn(`Accept all for ${countType(rows.length, typeName)}`, { act: 'p7:lib-accept-type', data: { plant: key, type: typeName }, kind: 'primary' }) : tc.undecided ? '' : chip('All decided', { tone: 'ok' })],
          cls: 'p7-type',
        }));
      });
      if (plantRow) {
        const blk = eqBlock(key, plantRow, show, isOpen(plantRow), alertIds);
        if (blk) {
          const tc = libCounts([plantRow]);
          cards.push(card({ title: 'The plant itself', sub: `Rounds and checks for ${p.name} as a whole${tc.undecided ? ` · ${tc.undecided} to decide` : ''}`, body: blk, actions: [tc.undecided > 1 ? btn('Accept all for the plant', { act: 'p7:lib-accept-eq', data: { plant: key, eq: 'plant' }, kind: 'primary' }) : tc.undecided ? '' : chip('All decided', { tone: 'ok' })], cls: 'p7-type' }));
        }
      }
      if (!cards.length) {
        const msg = { undecided: 'Nothing left to decide.', decided: 'Nothing decided yet.', blocked: 'Every proposal can be used.', all: 'The library proposes nothing for this plant.' }[show];
        parts.push(empty(msg, show !== 'all' ? btn('Show all', { href: qs('all') }) : ''));
      } else parts.push(`<div class="p7-cards">${cards.join('')}</div>`);
      if (show === 'undecided' && c.blocked) parts.push(note(`${pl(c.blocked, 'more proposal')} can't be used yet: ${c.blocked === 1 ? 'it needs' : 'they need'} a reading the plant graph doesn't send, or a connection between equipment (next phase). They stay listed, greyed, under "Can't be used yet".`, 'quiet'));
      return frame(key, 'library', parts.join(''), { crumbs: [{ label: 'What the library brings' }], title: 'What the library brings', sub });
    });
  }

  /* ── Equipment list ───────────────────────────────────────────────────────────────────────────────────── */
  const SEARCH = {};
  function searchBox(page, key, placeholder) {
    const val = SEARCH[`${page}:${key}`] || '';
    return `<input type="search" id="p7q" class="p7-search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" value="${esc(val)}" data-act="p7:search" data-live data-page="${esc(page)}" data-plant="${esc(key)}">`;
  }
  const matches = (q, ...xs) => { const s = String(q || '').trim().toLowerCase(); return !s || xs.some((x) => String(x || '').toLowerCase().includes(s)); };
  function stateCounts(list) {
    const order = ['trial', 'on', 'draft', 'off']; const n = {}; list.forEach((a) => { n[a.state] = (n[a.state] || 0) + 1; });
    return order.filter((s) => n[s]).map((s) => `<span class="p7-n">${n[s]}</span>${U.stateChip(s)}`).join(' ');
  }
  function equipment(params) {
    return guard(params, (key, q) => {
      const v = V(); const b = base(key);
      const eqs = arr(call(() => v.equipment(key), []));
      const sr = call(() => v.scadaReview(key), { groups: [] });
      const alertsBy = {}; arr(call(() => v.alerts(key), [])).forEach((a) => { if (a.eqId) (alertsBy[a.eqId] = alertsBy[a.eqId] || []).push(a); });
      const issuesBy = {}; arr(call(() => v.issues(key, { status: 'open' }), [])).forEach((i) => { [i.eqId, i.causedBy].filter(Boolean).forEach((id) => { issuesBy[id] = (issuesBy[id] || 0) + 1; }); });
      const diffsBy = {}; arr(call(() => v.overrides({ plant: key }), [])).forEach((o) => { if (o.eqId) diffsBy[o.eqId] = (diffsBy[o.eqId] || 0) + 1; });
      const show = ['all', 'issues', 'diffs', 'drawn'].includes(q.show) ? q.show : 'all';
      const keep = { all: () => true, issues: (e) => issuesBy[e.id], diffs: (e) => diffsBy[e.id], drawn: (e) => e.typeDiffers || e.notInDb };
      const query = SEARCH[`equipment:${key}`] || '';
      const byId = {}; eqs.forEach((e) => { byId[e.id] = e; });
      const groups = arr(sr.groups).length ? sr.groups : uniq(eqs.map((e) => e.typeName)).map((t) => ({ typeName: t, accepted: true, equipment: eqs.filter((e) => e.typeName === t).map((e) => ({ eqId: e.id })) }));
      const live = v.state(key) === 'live';
      const blocks = groups.map((g) => {
        const list = arr(g.equipment).map((x) => byId[x.eqId]).filter(Boolean).filter(keep[show]).filter((e) => matches(query, e.tag, e.name, e.typeName));
        if (!list.length) return '';
        const code = (byId[arr(g.equipment)[0] && g.equipment[0].eqId] || {}).dbType || g.code;
        const rows = list.map((e) => ({
          _href: eqHref(key, e.id),
          tag: `<a class="mono" href="${esc(eqHref(key, e.id))}">${esc(e.tag)}</a>${e.typeDiffers ? ' ' + chip(`Drawn as ${e.drawn}`, { tone: 'warn', title: `Stored as ${e.stored}` }) : ''}${e.notInDb ? ' ' + chip('Not in the database', { tone: 'bad' }) : ''}`,
          name: e.name,
          tier: H(`${esc(e.tierLabel || e.tier || '—')}${e.tierSource && e.tierSource.chip && e.tierSource.chip !== 'lib' ? ' ' + U.sourceChip(e.tierSource) : ''}`),
          alerts: arr(alertsBy[e.id]).length ? stateCounts(alertsBy[e.id]) : '<span class="muted">—</span>',
          issues: issuesBy[e.id] ? `<span class="tx-warn">${issuesBy[e.id]} open</span>` : '<span class="muted">—</span>',
          diffs: diffsBy[e.id] ? String(diffsBy[e.id]) : '<span class="muted">—</span>',
        }));
        const head = `<div class="p7-group-h"><h3>${esc(g.typeName)}</h3><span class="muted">${list.length}</span>${!live && !g.accepted ? ' ' + chip('Not accepted yet', { tone: 'warn', href: `${b}/scada?type=${enc(g.typeName)}` }) : ''}${code ? `<a class="p7-group-l" href="${esc(libHref(code))}">In the library →</a>` : ''}</div>`;
        return `<section class="p7-group">${head}${table({ cols: [{ label: 'Tag', key: 'tag' }, { label: 'Name', key: 'name' }, { label: 'Criticality', key: 'tier' }, { label: 'Alerts', key: 'alerts' }, { label: 'Open issues', key: 'issues' }, { label: 'Differences', key: 'diffs', cls: 'num' }], rows })}</section>`;
      }).filter(Boolean);
      const n = (f) => eqs.filter(f).length;
      const parts = [];
      parts.push(`<p class="lead">${esc(pieces(eqs.length))} of ${pl(groups.length, 'database type')}, as the plant graph sent them. Open one to see its readings, issues, tasks and details.</p>`);
      parts.push(`<div class="p7-tools">${filters([{ label: 'All', href: `${b}/equipment`, on: show === 'all', count: eqs.length }, { label: 'With open issues', href: `${b}/equipment?show=issues`, on: show === 'issues', count: n((e) => issuesBy[e.id]) }, { label: 'With differences', href: `${b}/equipment?show=diffs`, on: show === 'diffs', count: n((e) => diffsBy[e.id]) }, { label: 'Drawn as another type', href: `${b}/equipment?show=drawn`, on: show === 'drawn', count: n((e) => e.typeDiffers || e.notInDb) }].filter((f) => f.on || f.count || f.label === 'All'))}${searchBox('equipment', key, 'Find by tag, name or type')}</div>`);
      parts.push(blocks.length ? card({ body: blocks.join('') }) : empty(query ? H(`Nothing matches "${esc(query)}".`) : 'No equipment here.', show !== 'all' ? btn('Show all', { href: `${b}/equipment` }) : ''));
      return frame(key, 'equipment', parts.join(''));
    });
  }

  /* ── Readings (every reading, both states, grouped by equipment) ─────────────────────────────────────── */
  function readingLimits(key, r) {
    const v = V();
    if (r.nextPhase) return { html: `${chip('Next phase', { tone: 'next' })} <span class="p7-sub">On a connection between equipment</span>`, chips: '', none: false };
    if (!r.takesLimits) return { html: '<span class="muted">A counter: no limits</span>', chips: '', none: false };
    const dirs = arr(r.dirs);
    if (!dirs.length) return { html: `<span class="muted">${r.kind === 'status' ? 'ON or OFF: no limits needed' : 'No limits'}</span>`, chips: '', none: false };
    const seen = {}; const chips = []; let any = false;
    const bars = dirs.map((dir) => {
      const L = call(() => v.limitsOf(key, r.id, dir), null); if (!L) return '';
      const has = U.BANDS.some((bd) => L.bands && L.bands[bd] != null); any = any || has;
      /* v7: a band the plant removed ("No limit", Changed here) still says where it comes from, so the row never claims "From the library" alone */
      U.BANDS.forEach((bd) => { const pb = L.perBand && L.perBand[bd]; if (pb && (pb.value != null || !has || pb.overrideId)) { const t = pb.chipText || pb.chip; if (!seen[t]) { seen[t] = 1; chips.push(U.sourceChip(pb)); } } });
      const text = v.limitsText ? v.limitsText(L.bands, dir, L.unit || r.unit, L.kind || r.kind) : '';
      if (!has) return '';
      const val = r.latest && r.kind !== 'status' ? r.latest.v : null;
      return `<div class="p7-lim">${r.kind === 'status' ? '' : U.bandBar({ dir, bands: L.bands, value: val, valid: r.valid, unit: r.unit, compact: true })}<small>${esc(text)}</small></div>`;
    }).join('');
    return { html: any ? bars : '', chips: chips.join(' '), none: !any };
  }
  /* the one limits editor lives on the object page (object7): open its sheet in place, else go to the equipment page */
  function limitsBtn(key, r, lim) {
    if (r.nextPhase || !r.takesLimits || !arr(r.dirs).length || (r.kind === 'status' && lim.none)) return '';
    return `<div class="p7-lbtn">${btn(lim.none ? 'Set limits' : 'Change limits', { act: 'p7:limits', data: { plant: key, sensor: r.id, dir: r.primaryDir || arr(r.dirs)[0], eq: r.eqId || '' }, small: true, kind: 'ghost' })}</div>`;
  }
  function readings(params) {
    return guard(params, (key, q) => {
      const v = V(); const b = base(key);
      const rs = arr(call(() => v.readings(key), []));
      const eqs = arr(call(() => v.equipment(key), []));
      const alertsBy = {}; arr(call(() => v.alerts(key), [])).forEach((a) => { (alertsBy[a.sensorId] = alertsBy[a.sensorId] || []).push(a); });
      const cl = call(() => v.checklist(key), { gaps: [] });
      /* v7: the chip, this filter and the Readiness gap all use core's one test (manual and lab readings included) */
      const noLim = new Set(v.noLimitsYet ? rs.filter((r) => v.noLimitsYet(key, r)).map((r) => r.id) : arr((arr(cl.gaps).find((g) => g.id === 'nolimits') || {}).items).map((x) => x.sensorId));
      const show = ['all', 'nolimits', 'manual', 'next'].includes(q.show) ? q.show : 'all';
      const keep = { all: () => true, nolimits: (r) => noLim.has(r.id), manual: (r) => r.kind === 'manual', next: (r) => r.nextPhase };
      const query = SEARCH[`readings:${key}`] || '';
      const eqById = {}; eqs.forEach((e) => { eqById[e.id] = e; });
      const order = eqs.map((e) => e.id).concat([null]);
      const byEq = new Map(order.map((id) => [id, []]));
      rs.filter(keep[show]).filter((r) => matches(query, r.name, r.tag, r.eqTag, (eqById[r.eqId] || {}).name)).forEach((r) => { const k = byEq.has(r.eqId) ? r.eqId : null; byEq.get(k).push(r); });
      const blocks = [];
      byEq.forEach((list, eqId) => {
        if (!list.length) return;
        const e = eqId ? eqById[eqId] : null;
        const rows = list.map((r) => {
          const lim = readingLimits(key, r);
          const kind = r.kind === 'manual' ? `${r.source === 'lab' ? 'Lab' : 'Manual'}<div class="p7-sub">${esc(r.expected || '')}</div>` : 'SCADA';
          const nowV = r.latest ? `<span class="mono">${esc(fmtVal(r.latest.v, r.unit, r.kind))}</span>` : r.kind === 'manual' ? '<span class="muted">Entered by hand</span>' : '<span class="muted">—</span>';
          const al = arr(alertsBy[r.id]);
          const alertHtml = al.length ? al.map((a) => `<a class="p7-al" href="${esc(alertHref(key, a.id))}">${U.stateChip(a.state, { title: a.name })}</a>`).join(' ') : '<span class="muted">No alert</span>';
          const href = r.eqId ? eqHref(key, r.eqId, 'readings') : r.scheduleId ? taskHref(key, r.scheduleId) : null;
          return {
            _href: href,
            name: `${href ? `<a href="${esc(href)}">${esc(r.name)}</a>` : esc(r.name)}${r.tag ? `<div class="p7-sub mono">${esc(r.tag)}</div>` : ''}`,
            kind, now: nowV,
            limits: H(`${lim.html || ''}${limitsBtn(key, r, lim)}` || '<span class="muted">—</span>'),
            src: (v.noLimitsYet ? v.noLimitsYet(key, r) : lim.none) ? chip('No limits yet', { tone: 'none' }) : lim.chips || '<span class="muted">—</span>',
            alert: r.nextPhase || !r.takesLimits ? '<span class="muted">—</span>' : alertHtml,
            _cls: r.nextPhase ? 'p7-quiet' : '',
          };
        });
        const head = e ? `<div class="p7-group-h"><h3><a href="${esc(eqHref(key, e.id))}"><span class="mono">${esc(e.tag)}</span> ${esc(e.name)}</a></h3><span class="muted">${esc(e.typeName)}</span></div>` : '<div class="p7-group-h"><h3>The plant</h3><span class="muted">Manual and lab readings for the plant as a whole</span></div>';
        blocks.push(`<section class="p7-group">${head}${table({ cols: [{ label: 'Reading', key: 'name' }, { label: 'Kind', key: 'kind' }, { label: 'Now', key: 'now' }, { label: 'Limits', key: 'limits' }, { label: 'Where they come from', key: 'src' }, { label: 'Alert', key: 'alert' }], rows })}</section>`);
      });
      const n = (f) => rs.filter(f).length;
      const nScada = n((r) => r.kind !== 'manual' && !r.nextPhase); const nMan = n((r) => r.kind === 'manual'); const nNext = n((r) => r.nextPhase);
      const parts = [];
      parts.push(`<p class="lead">${pl(nScada, 'reading')} from the plant graph${nNext ? `, plus ${nNext} on pipes between equipment (next phase)` : ''}${nMan ? `${nNext ? ',' : ''} and ${nMan} manual or lab ${nMan === 1 ? 'reading' : 'readings'}` : ''}, grouped by equipment. Manual and lab readings take limits the same way and say how often they are expected.</p>`);
      parts.push(`<div class="p7-tools">${filters([{ label: 'All', href: `${b}/readings`, on: show === 'all', count: rs.length }, { label: 'No limits yet', href: `${b}/readings?show=nolimits`, on: show === 'nolimits', count: noLim.size }, { label: 'Manual and lab', href: `${b}/readings?show=manual`, on: show === 'manual', count: nMan }, { label: 'Next phase', href: `${b}/readings?show=next`, on: show === 'next', count: n((r) => r.nextPhase) }].filter((f) => f.on || f.count || f.label === 'All'))}${searchBox('readings', key, 'Find by reading, tag or equipment')}</div>`);
      parts.push(blocks.length ? card({ body: blocks.join(''), actions: [U.sampleTag()], title: 'Every reading', sub: 'Values under "Now" are sample readings.' }) : empty(query ? H(`Nothing matches "${esc(query)}".`) : show === 'nolimits' ? 'Every reading that takes limits has them.' : 'No readings here.', show !== 'all' ? btn('Show all', { href: `${b}/readings` }) : ''));
      return frame(key, 'readings', parts.join(''));
    });
  }

  /* ── Tasks (rule 11: one task per type for routine checks, routine work and manual tests) ─────────────── */
  function taskRows(key, list, live) {
    return list.map((t) => {
      const where = t.kind === 'group'
        ? `${esc(arr(t.eqIds).length > 1 ? `Shared task for ${countType(t.eqIds.length, t.typeName)}: ${shortList(arr(t.tags), 6)}` : `On ${shortList(arr(t.tags), 6)}`)} ${chip('to confirm', { tone: 'muted', title: 'One task for the type at this plant, with a line per piece of equipment: to confirm with the plant team' })}`
        : t.plantLevel ? 'The plant' : arr(t.eqIds).length ? `<a class="mono" href="${esc(eqHref(key, t.eqIds[0], 'tasks'))}">${esc(arr(t.tags)[0] || '')}</a>` : '';
      const due = !live ? '<span class="muted">At go live</span>' : t.due == null ? '<span class="muted">—</span>' : `<span class="${t.overdue ? 'tx-bad' : t.status === 'due' ? 'tx-warn' : ''}">${esc(fmt(t.due))}</span>${t.overdue ? '<div class="p7-sub tx-bad">Overdue</div>' : ''}`;
      const stTone = { due: 'warn', doing: 'info', upcoming: 'muted', waiting: 'muted' }[t.status] || 'muted';
      return {
        _href: taskHref(key, t.id),
        name: `<a href="${esc(taskHref(key, t.id))}">${esc(t.name)}</a><div class="p7-sub">${where}</div>`,
        every: `${esc(cap(t.everyText || ''))}${t.source ? ' ' + U.sourceChip(t.source) : ''}${t.runHours && t.runHours.overrideId && t.basis === 'either' ? ` <span class="muted small">run-hours:</span> ${U.sourceChip(t.runHours)}` : ''}${t.source && t.source.notInLib && t.source.chip !== 'notinlib' ? '<div class="p7-sub">Not in the library</div>' : ''}<div class="p7-sub">${esc(t.workLabel || '')}</div>`,
        due, last: t.lastDone != null ? fmtDay(t.lastDone) : '<span class="muted">—</span>',
        st: chip(t.statusLabel || cap(t.status || ''), { tone: t.overdue ? 'bad' : stTone }),
      };
    });
  }
  /* v7: condition-based work: what raises it (a line on an equipment reading) instead of how often */
  function lineTable(key, list, live) {
    const rows = list.map((t) => {
      const w = t.from || {}; const rd = w.eqId ? `<a href="${esc(eqHref(key, w.eqId))}">${esc(w.whenText || '')}</a>` : esc(w.whenText || '');
      const st = !live ? '<span class="muted">At go live</span>' : t.status === 'due' || t.status === 'doing' ? `<span class="${t.overdue ? 'tx-bad' : 'tx-warn'}">Raised ${esc(fmt(t.raisedAt || t.due))}</span>${t.raisedBy ? `<div class="p7-sub">at ${esc(fmtVal(t.raisedBy.value, w.unit || '', w.kind))}</div>` : ''}` : '<span class="muted">—</span>';
      return { _href: taskHref(key, t.id), name: `<a href="${esc(taskHref(key, t.id))}">${esc(t.name)}</a><div class="p7-sub">Filed at ${esc(t.filed && t.filed.kind === 'up' ? t.filed.tag + ', a unit process' : 'the plant')}</div>`, when: rd, due: st, last: t.lastDone != null ? fmtDay(t.lastDone) : '<span class="muted">—</span>', st: chip(t.statusLabel || cap(t.status || ''), { tone: t.overdue ? 'bad' : { due: 'warn', doing: 'info' }[t.status] || 'muted' }) };
    });
    return table({ cols: [{ label: 'Task', key: 'name' }, { label: 'Raised when', key: 'when' }, { label: 'Raised', key: 'due', cls: 'nowrap' }, { label: 'Last done', key: 'last', cls: 'nowrap' }, { label: 'State', key: 'st' }], rows });
  }
  function taskTable(key, list, live) {
    return table({ cols: [{ label: 'Task', key: 'name' }, { label: 'How often', key: 'every' }, { label: 'Next due', key: 'due', cls: 'nowrap' }, { label: 'Last done', key: 'last', cls: 'nowrap' }, { label: 'State', key: 'st' }], rows: taskRows(key, list, live) });
  }
  function tasks(params) {
    return guard(params, (key, q) => {
      const v = V(); const b = base(key); const live = v.state(key) === 'live';
      const ts = arr(call(() => v.tasks(key), []));
      if (!ts.length) {
        return frame(key, 'tasks', empty('No tasks yet. Tasks arrive when you accept what the library brings for each piece of equipment.', btn('What the library brings', { href: `${b}/library`, kind: 'primary' })));
      }
      const a = Math.round(call(() => v.tasksPerDay(key, { each: false }), 0)); const e = Math.round(call(() => v.tasksPerDay(key, { each: true }), 0));
      const each = call(() => v.eachOf(key).phrase, 'if each piece of equipment gets its own');   /* v7: one wording on every plant */
      const both = `${a} ${a === 1 ? 'task' : 'tasks'} a day${e !== a ? ` (${e} ${each} — to confirm)` : ''}`;
      const show = ['all', 'shared', 'each', 'condition'].includes(q.show) ? q.show : 'all';
      const due = live ? ts.filter((t) => t.status === 'due' || t.status === 'doing' || t.overdue) : [];
      const groups = ts.filter((t) => t.kind === 'group'); const singles = ts.filter((t) => t.kind !== 'group' && !t.plantLevel); const plantL = ts.filter((t) => t.kind !== 'group' && t.kind !== 'line' && t.plantLevel); const lineL = ts.filter((t) => t.kind === 'line');
      const parts = [];
      parts.push(`<p class="lead">${live ? `<b>${esc(both)}.</b> ` : `<b>When the plant goes live: ${esc(both)}.</b> First due dates are spread across each task's own interval, so day one is not a pile-up. `}Routine checks, routine work and manual tests are one task per type at this plant, with a line for each piece of equipment; maintenance and calibration stay on each piece of equipment.</p>`);
      parts.push(filters([{ label: 'All', href: `${b}/tasks`, on: show === 'all', count: ts.length }, { label: 'One per type', href: `${b}/tasks?show=shared`, on: show === 'shared', count: groups.length }, { label: 'On each piece of equipment', href: `${b}/tasks?show=each`, on: show === 'each', count: singles.length + plantL.length }].concat(lineL.length ? [{ label: 'Condition-based', href: `${b}/tasks?show=condition`, on: show === 'condition', count: lineL.length }] : [])));
      if (due.length && show === 'all') parts.push(card({ title: due.length === 1 ? 'One task due now' : `${due.length} tasks due now`, body: taskTable(key, due, live), tone: due.some((t) => t.overdue) ? 'bad' : 'warn' }));
      if (show === 'all' || show === 'condition') if (lineL.length) parts.push(card({ title: 'Condition-based work', sub: 'Raised when a reading on equipment crosses a range that triggers a task. Filed at a unit process or the plant, never on the equipment; that range opens no issue.', body: lineTable(key, lineL, live) }));
      if (show === 'condition') return frame(key, 'tasks', parts.join(''));
      if (show !== 'each' && groups.length) parts.push(card({ title: 'One task per type', sub: 'Routine checks, routine work and manual tests: one task for the type at this plant, with a line per piece of equipment. To confirm with the plant team.', body: taskTable(key, groups, live) }));
      if (show !== 'shared' && singles.length) parts.push(card({ title: 'On each piece of equipment', sub: 'Preventive maintenance and calibration stay with the equipment they are done on.', body: taskTable(key, singles, live) }));
      if (show !== 'shared' && plantL.length) parts.push(card({ title: 'The plant', sub: 'Rounds and checks for the plant as a whole.', body: taskTable(key, plantL, live) }));
      if (!live) parts.push(note('Tasks start when the plant goes live. A task can carry the date it was last done (on its page); its first due date then counts from that date.', 'quiet'));
      return frame(key, 'tasks', parts.join(''));
    });
  }

  /* ── go live, return to Commissioning ─────────────────────────────────────────────────────────────────── */
  function openGoLive(key) {
    const v = V(); const p = plantOf(key); if (!p) return;
    const pv = call(() => v.goLivePreview(key), null); if (!pv) { U.toast('Go live could not be prepared.'); return; }
    const cl = pv.checklist || call(() => v.checklist(key), {});
    if (!cl.canGoLive) { U.toast(cl.whyNot || 'Go live is blocked.'); return; }
    /* v7: the loud lines are the ones people feel at once, and an alert that turns On without a trial */
    const changes = arr(pv.changes).map((c) => `<li${/^(Alerts reach people|Calls and the hooter)/.test(c) || c === pv.untriedText ? ' class="p7-loud"' : ''}>${esc(c)}</li>`).join('');
    const ts = trialSummary(key);
    const trialText = ts ? `The trial so far: ${ts.countText}; ${pl(ts.firings, 'trial firing')}${ts.noisy.length ? `; noisy: ${ts.noisy.map((x) => `${x.a.name} (${rate(x.ts.perDay)} a day)`).join(', ')}` : '; none noisy'}. Sample readings.` : '';
    const gaps = arr(cl.gaps);
    const body = `<p>From the moment you confirm:</p><ol class="p7-changes">${changes}</ol>`
      + (trialText ? note(trialText, 'quiet') : '')
      + (gaps.length ? `<div class="p7-remain"><p><b>${pl(gaps.length, 'gap')} ${gaps.length === 1 ? 'remains' : 'remain'}</b>; ${gaps.length === 1 ? "it doesn't" : "they don't"} block:</p><ul>${gaps.map((g) => `<li>${esc(g.text)}</li>`).join('')}</ul></div>` : '');
    U.modal({ title: `Go live: ${p.name}`, sub: 'Commissioning ends and the plant runs for real.', body, foot: btn('Not yet', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Go live', { act: 'p7:golive-confirm', data: { plant: key }, kind: 'primary' }) });
  }
  function openReturn(key) {
    const p = plantOf(key); if (!p) return;
    /* v7: what would then block going live again (a Live plant runs with proposals undecided; Commissioning does not): from the checklist */
    const cl = call(() => V().checklist(key), null); const tr = (cl && cl.tracks) || {};
    const und = ((tr.library || {}).total || 0) - ((tr.library || {}).done || 0); const scLeft = ((tr.scada || {}).total || 0) - ((tr.scada || {}).done || 0);
    const block = [scLeft ? `${pl(scLeft, 'equipment type')} the plant graph found not accepted` : '', und ? `${und === 1 ? 'one library proposal' : `${und} library proposals`} not decided` : ''].filter(Boolean);
    const body = `<ul class="p7-changes">
      <li>Alerts go back On trial: firings are recorded, nothing reaches the operators.</li>
      <li class="p7-loud">On a new plant an Emergency is kept as a trial firing too.</li>
      <li>Tasks stop until the plant goes live again.</li>
      <li>Home shows Readiness again, with its checklist.</li>${block.length ? `
      <li class="p7-loud">Go live is then blocked until these are done: ${esc(block.join(', and '))} (<a href="${esc(base(key))}/${und ? 'library' : 'scada'}">${und ? 'What the library brings' : 'What the plant graph has'}</a>).</li>` : ''}</ul>`
      + U.field({ label: 'Why it goes back', hint: 'Required. It is kept in Activity.', html: '<textarea id="p7-reason" placeholder="For example: aeration grid rebuild, two weeks"></textarea>' });
    U.modal({ title: `Return ${p.name} to Commissioning?`, body, foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Return to Commissioning', { act: 'p7:return-confirm', data: { plant: key }, kind: 'danger' }) });
  }
  const REASONS = ['Not fitted at this plant', 'Another task already covers it', 'The plant team does this differently'];
  function openReject(key, pid) {
    const v = V(); const r = arr(call(() => v.libraryReview(key), [])).find((x) => arr(x.proposals).some((y) => y.pid === pid));
    const pr = r && r.proposals.find((y) => y.pid === pid); if (!pr) { U.toast('That proposal is no longer there.'); return; }
    const where = r.eqId === 'plant' ? 'the plant' : pr.tag;
    const quick = `<div class="p7-quick">${REASONS.map((t) => btn(t, { act: 'p7:reason-pick', data: { text: t }, small: true })).join('')}</div>`;
    const body = `<p>The library keeps it; ${esc(plantOf(key).name)} leaves it out${pr.kind === 'alert' ? ', and it shows under Differences from the library' : ''}. Say why, so the next person knows.</p>${quick}`
      + U.field({ label: 'Why', html: '<textarea id="p7-reason" placeholder="In a few words"></textarea>' });
    U.modal({ title: `Not for this plant: ${pr.name} on ${where}`, body, foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Not for this plant', { act: 'p7:lib-reject-confirm', data: { plant: key, pid }, kind: 'primary' }) });
  }
  function reasonFrom(el) {
    const box = el && el.closest ? el.closest('.modal') : null;
    const ta = (box && box.querySelector('#p7-reason')) || (typeof document !== 'undefined' && document.querySelector ? document.querySelector('#p7-reason') : null);
    return { ta, text: ta ? String(ta.value || '').trim() : '' };
  }
  function needReason(ta, msg) {
    if (!ta) { U.toast(msg); return; }
    if (ta.classList) ta.classList.add('bad');
    const f = ta.parentNode; if (f && f.querySelector && !f.querySelector('.field-e')) { const e = document.createElement('p'); e.className = 'field-e'; e.textContent = msg; f.appendChild(e); }
    try { ta.focus(); } catch (e) { /* ignore */ }
  }
  /* v7: "N alerts go On trial" only when alerts were accepted; otherwise why none were (core's acceptAllFor says) */
  const acceptTail = (r) => r.tail || (r.alerts ? `${pl(r.alerts, 'alert')} ${r.alerts === 1 ? 'goes' : 'go'} On trial` : 'no alert among them');
  const findProp = (key, pid) => { let out = null; arr(call(() => V().libraryReview(key), [])).forEach((r) => arr(r.proposals).forEach((p) => { if (p.pid === pid) out = p; })); return out; };
  function afterDecide(key) {
    const v = V(); if (v.state(key) !== 'commissioning') return '';
    const cl = call(() => v.checklist(key), null);
    return cl && cl.canGoLive ? ` Nothing blocks go live now: <a href="${esc(base(key))}">see Readiness</a>.` : '';
  }

  /* ── actions ──────────────────────────────────────────────────────────────────────────────────────────── */
  U.on('p7:usercenter', () => { U.toast('People are kept in the User Center, outside this prototype. Readiness reads them from there; they are not edited here.'); return false; });
  U.on('p7:scada-fix', () => { U.toast('Fix it in the plant graph, then read again: the console never edits what the plant graph sends.'); return false; });
  U.on('p7:scada-accept', (el) => {
    const key = dget(el, 'plant'); const type = dget(el, 'type');
    const g = arr(call(() => V().scadaReview(key).groups, [])).find((x) => x.typeName === type);
    const r = call(() => V().acceptScadaGroup(key, type), { ok: false, error: 'That did not work.' });
    say(r.ok ? `Accepted what the plant graph found for ${esc(g ? countType(g.count, type) : type)}.` : esc(r.error || 'That did not work.'));
  });
  U.on('p7:scada-accept-all', (el) => {
    const key = dget(el, 'plant');
    const r = call(() => V().acceptAllScada(key), { ok: false });
    say(r.ok ? `Accepted ${pl(r.count || 0, 'equipment type')}. Next: <a href="${esc(base(key))}/library">what the library brings</a>.` : 'That did not work.');
  });
  U.on('p7:lib-accept', (el) => {
    const key = dget(el, 'plant'); const pid = dget(el, 'pid'); const pr = findProp(key, pid);
    const r = call(() => V().decide(key, pid, 'accept'), { ok: false, error: 'That did not work.' });
    if (!r.ok) { U.toast(r.error || 'That did not work.'); return; }
    const live = V().state(key) === 'live';
    const what = pr ? `${pr.name} on ${pr.eqId === 'plant' ? 'the plant' : pr.tag}` : 'the proposal';
    const then = pr && pr.kind === 'alert' ? (live ? ' It runs On trial for 7 days before it reaches people.' : ' It runs On trial: trial firings are recorded, nothing is sent.') : (live ? '' : ' It starts at go live.');
    say(`Accepted: ${esc(what)}.${then}${afterDecide(key)}`, { ms: 7000 });
  });
  U.on('p7:lib-accept-eq', (el) => {
    const key = dget(el, 'plant'); const eq = dget(el, 'eq');
    const r = call(() => V().acceptAllFor(key, { eqId: eq }), { ok: false });
    say(r.ok ? `Accepted ${pl(r.count || 0, 'proposal')} for ${esc(eq === 'plant' ? 'the plant' : tagOf(key, eq))}; ${esc(acceptTail(r))}.${afterDecide(key)}` : 'That did not work.', { ms: 7000 });
  });
  U.on('p7:lib-accept-type', (el) => {
    const key = dget(el, 'plant'); const type = dget(el, 'type');
    const n = arr(call(() => V().libraryReview(key), [])).filter((x) => x.typeName === type && x.eqId !== 'plant').length;
    const r = call(() => V().acceptAllFor(key, { typeName: type }), { ok: false });
    say(r.ok ? `Accepted ${pl(r.count || 0, 'proposal')} for ${esc(countType(n, type))}; ${esc(acceptTail(r))}.${afterDecide(key)}` : 'That did not work.', { ms: 7000 });
  });
  U.on('p7:lib-accept-all', (el) => {
    const key = dget(el, 'plant'); const p = plantOf(key);
    const lr0 = arr(call(() => V().libraryReview(key), [])); const c = libCounts(lr0); const lc = lineCounts(lr0);
    /* v7: the consequence before the click, by plant state: on a Live plant alerts reach people after 7 days On trial and tasks start
       now, so the tasks a day before and after are shown (worked out by core's dry run of the same Accept all) */
    const pv = call(() => V().acceptAllPreview(key, {}), null); const live = pv ? pv.live : V().state(key) === 'live';
    const perDay = (x) => `${x.perDay} ${x.perDay === 1 ? 'task' : 'tasks'} a day${x.perDayEach !== x.perDay ? ` (${x.perDayEach} ${esc(pv.eachPhrase || 'if each piece of equipment gets its own')} — to confirm)` : ''}`;
    const alertsLine = pv && !pv.alerts ? 'No alert is among them.' : live ? `${pv ? `${pl(pv.alerts, 'alert')} run` : 'Alerts run'} On trial for 7 days, then reach people.` : `${pv ? `${pl(pv.alerts, 'alert')} run` : 'Alerts run'} On trial: trial firings are recorded, nothing is sent.`;
    const tasksLine = !pv ? (live ? 'Tasks start now.' : 'Tasks start at go live.') : !pv.newTasks ? 'No new tasks.' : live ? `<b>Tasks start now: ${perDay(pv.after)}, up from ${pv.before.perDay} a day.</b>` : `Tasks start at go live: ${perDay(pv.after)}.`;
    U.confirm({
      title: `Accept all ${lc.undecided} lines?`,
      body: `<p>Every undecided alert and task the library proposes for ${esc(p ? p.name : 'this plant')} is accepted.</p><ul class="p7-changes"><li>${alertsLine}</li><li${live && pv && pv.newTasks ? ' class="p7-loud"' : ''}>${tasksLine}</li></ul><p>You can still leave any of them out afterwards.</p>`,
      ok: `Accept all ${lc.undecided}`,
      onOk: () => {
        const r = call(() => V().acceptAllFor(key, {}), { ok: false });
        say(r.ok ? `Accepted ${pl(r.count || 0, 'proposal')}; ${esc(acceptTail(r))}.${afterDecide(key)}` : 'That did not work.', { ms: 7000 });
      },
    });
    return false;
  });
  U.on('p7:lib-reject', (el) => { openReject(dget(el, 'plant'), dget(el, 'pid')); return false; });
  U.on('p7:lib-accept-group', (el) => {
    const key = dget(el, 'plant'); const pids = String(dget(el, 'pids') || '').split(',').filter(Boolean); let n = 0; let name = '';
    pids.forEach((pid) => { const pr = findProp(key, pid); if (pr) name = pr.name; const r = call(() => V().decide(key, pid, 'accept'), { ok: false }); if (r.ok) n++; });
    say(`Accepted: ${esc(name)}, one task for ${pl(n, 'piece')} of equipment${V().state(key) === 'live' ? '' : '. It starts at go live'}.${afterDecide(key)}`, { ms: 7000 });
  });
  U.on('p7:lib-reject-group', (el) => {
    const key = dget(el, 'plant'); const pids = dget(el, 'pids'); const name = dget(el, 'name') || 'it';
    const quick = `<div class="p7-quick">${REASONS.map((t) => btn(t, { act: 'p7:reason-pick', data: { text: t }, small: true })).join('')}</div>`;
    const body = `<p>The library keeps it; ${esc(plantOf(key).name)} leaves it out for every piece of equipment it was proposed for. Say why, so the next person knows.</p>${quick}` + U.field({ label: 'Why', html: '<textarea id="p7-reason" placeholder="In a few words"></textarea>' });
    U.modal({ title: `Not for this plant: ${name}`, body, foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Not for this plant', { act: 'p7:lib-reject-group-confirm', data: { plant: key, pids }, kind: 'primary' }) });
    return false;
  });
  U.on('p7:lib-reject-group-confirm', (el) => {
    const key = dget(el, 'plant'); const pids = String(dget(el, 'pids') || '').split(',').filter(Boolean); const r0 = reasonFrom(el);
    if (!r0.text) { needReason(r0.ta, 'Say why it is not for this plant.'); return false; }
    let n = 0; let name = ''; pids.forEach((pid) => { const pr = findProp(key, pid); if (pr) name = pr.name; const r = call(() => V().decide(key, pid, 'reject', { reason: r0.text }), { ok: false }); if (r.ok) n++; });
    U.closeModal(true);
    say(`Left out at this plant: ${esc(name)}, for ${pl(n, 'piece')} of equipment.${afterDecide(key)}`, { ms: 7000 });
    return undefined;
  });
  U.on('p7:reason-pick', (el) => { const r = reasonFrom(el); if (r.ta) { r.ta.value = dget(el, 'text') || ''; if (r.ta.classList) r.ta.classList.remove('bad'); try { r.ta.focus(); } catch (e) { /* ignore */ } } return false; });
  U.on('p7:lib-reject-confirm', (el) => {
    const key = dget(el, 'plant'); const pid = dget(el, 'pid'); const r0 = reasonFrom(el);
    if (!r0.text) { needReason(r0.ta, 'Say why it is not for this plant.'); return false; }
    const pr = findProp(key, pid);
    const r = call(() => V().decide(key, pid, 'reject', { reason: r0.text }), { ok: false, error: 'That did not work.' });
    U.closeModal(true);
    if (!r.ok) { U.toast(r.error || 'That did not work.'); return undefined; }
    say(`Left out at this plant: ${esc(pr ? `${pr.name} on ${pr.eqId === 'plant' ? 'the plant' : pr.tag}` : 'the proposal')}.${pr && pr.kind === 'alert' ? ' It shows under Differences from the library.' : ''}${afterDecide(key)}`, { ms: 7000 });
    return undefined;
  });
  U.on('p7:golive', (el) => { openGoLive(dget(el, 'plant')); return false; });
  U.on('p7:golive-confirm', (el) => {
    const key = dget(el, 'plant'); const p = plantOf(key);
    const r = call(() => V().goLive(key), { ok: false, error: 'Go live did not work.' });
    U.closeModal(true);
    if (!r.ok) { U.toast(r.error || 'Go live did not work.'); return undefined; }
    const n = r.preview ? r.preview.alertsOn : null;
    say(`${esc(p ? p.name : 'The plant')} is Live from ${esc(fmt(now()))}.${n != null ? ` ${pl(n, 'alert')} ${n === 1 ? 'is' : 'are'} On;` : ''} calls, the hooter and tasks have started.`, { ms: 8000 });
    return undefined;
  });
  U.on('p7:return', (el) => { openReturn(dget(el, 'plant')); return false; });
  U.on('p7:return-confirm', (el) => {
    const key = dget(el, 'plant'); const r0 = reasonFrom(el);
    if (!r0.text) { needReason(r0.ta, 'Say why the plant goes back to Commissioning.'); return false; }
    const r = call(() => V().returnToCommissioning(key, r0.text), { ok: false, error: 'That did not work.' });
    U.closeModal(true);
    say(r.ok ? `${esc((plantOf(key) || {}).name || 'The plant')} is back in Commissioning. Alerts run On trial; Emergencies are still sent to the Leads.` : (r.error || 'That did not work.'), { ms: 7000 });
    return undefined;
  });
  U.on('p7:limits', (el) => {
    const key = dget(el, 'plant'); const sensorId = dget(el, 'sensor'); const dir = dget(el, 'dir') || undefined; const eq = dget(el, 'eq');
    const O = W.V7OBJ;
    if (O && typeof O.openLimits === 'function') { O.openLimits({ plant: key, sensorId, dir }); return false; }
    if (eq) U.go(`${eqHref(key, eq)}?limits=${enc(sensorId)}${dir ? `&dir=${enc(dir)}` : ''}`);
    else U.toast('Limits are changed on the equipment page.');
    return false;
  });
  U.on('p7:search', (el) => { SEARCH[`${dget(el, 'page')}:${dget(el, 'plant')}`] = el.value || ''; U.render(); return false; });

  /* ── routes ───────────────────────────────────────────────────────────────────────────────────────────── */
  U.route('p/:plant', home);
  U.route('p/:plant/scada', scada);
  U.route('p/:plant/library', library);
  U.route('p/:plant/equipment', equipment);
  U.route('p/:plant/readings', readings);
  U.route('p/:plant/tasks', tasks);

  /* our small stylesheet, if the page does not link it already */
  try { if (typeof document !== 'undefined' && document.querySelector && !document.querySelector('link[href*="plant7.css"]')) U.addCss('assets/plant7.css?v=1'); } catch (e) { /* ignore */ }

  W.V7PLANT = { frame, tabs, typePlural, openGoLive, openReturn, pages: { home, scada, library, equipment, readings, tasks }, _search: SEARCH };
}());
