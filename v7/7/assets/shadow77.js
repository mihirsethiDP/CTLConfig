/* v7/7 · shadow77.js — the shadow run: CloseTheLoop beside the alerting a plant has today.
   A plant that already has alerting does not switch over blind. While it is set up, CloseTheLoop runs On trial on the plant's
   readings and sends nothing; the alerting the plant has today (called "legacy" here) stays the one people act on. Every firing on
   either side lands in one comparison list, paired by equipment, reading and time. A difference gets one reason from a person.
   Go live is held until the gate is through: 14 days of shadow, and no Major or Emergency that only legacy raised left unexplained.

   window.V7SHADOW:
     has(key)                 the plant has alerting today, so it has a shadow run (a brand-new plant has none)
     open(key)                has(key), and the plant has never been Live in CloseTheLoop
     rules(key)               {mapped:[{rule, alertId, alertName, eqTag, reading, dir}], unmapped:[{rule, why}], newCover:[{alertId, alertName, eqTag}]}
     rows(key)                the comparison list, newest first: {id, at, eqTag, reading, what, ctl, legacy, outcome, blocks, reason, note, by, reasonAt, fixed}
                              outcome: 'matched' | 'severity' | 'ctl' (CloseTheLoop only) | 'legacy' (legacy only)
     days(key)                per day: {day, ctl, legacy, matched, differ}
     gate(key)                {since, days, need, unexplained, sinceFix, needAfterFix, pass, text, parts[]}
     setReason(key, id, reasonId, note, who) · markFixed(key, id, who)
     REASONS                  the seven reasons a difference can have
   The legacy side is sample data, made from the plant's own trial firings so the two sides tell one story. No DOM in this half;
   the page is registered at the end when the shell is there. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7;
  const MIN = 60000, DAY = 24 * 60 * MIN; const NEED_DAYS = 14, AFTER_FIX_DAYS = 7, PAIR_MIN = 15;
  const LEGACY = { vedanta: true, digitalpaani: true };
  const RANK = { caution: 1, minor: 2, major: 3, emergency: 4 }; const BY_RANK = [null, 'caution', 'minor', 'major', 'emergency'];
  const REASONS = [
    { id: 'limit', label: 'The limit differs on purpose' },
    { id: 'hold', label: 'The hold time differs' },
    { id: 'paused', label: 'The sensor was paused as not trusted' },
    { id: 'norule', label: 'The legacy rule has no CloseTheLoop alert, and should not have one' },
    { id: 'notyet', label: 'The alert had not been accepted yet' },
    { id: 'dup', label: 'A legacy duplicate' },
    { id: 'gap', label: 'A real gap: the configuration needs a fix', fix: true },
  ];
  const reasonOf = (id) => REASONS.find((r) => r.id === id) || null;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, d) => { try { const r = fn(); return r == null ? d : r; } catch (e) { return d; } };
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  const PS = (key) => { const v = V(); return v && v.S && v.S.plants ? v.S.plants[key] : null; };
  function store(key) { const P = PS(key); if (!P) return { reasons: {} }; if (!P.shadow) P.shadow = { reasons: {}, lastFixAt: null }; return P.shadow; }

  function has(key) { return !!LEGACY[key] && !!PS(key); }
  function open(key) { const p = safe(() => V().plant(key), null); return has(key) && !!p && p.state === 'commissioning' && !p.wasLive; }
  function since(key) {
    const P = PS(key); if (!P) return null;
    const ts = Object.values(P.alerts || {}).map((x) => x.trialSince).filter((x) => x != null);
    return ts.length ? Math.min(...ts) : null;
  }
  const until = (key) => { const P = PS(key); return P && P.goLiveAt != null ? P.goLiveAt : V().now(); };

  /* the plant's rules today, beside the alerts that take them over. Two alerts are new coverage (legacy never had a rule); two
     legacy rules have no alert here, and are named. */
  const NO_RULE = /Sludge blanket|Chemical tank/i;
  const UNMAPPED = [
    { id: 'u1', rule: 'MCC panel door open', eqTag: 'MCC', reading: 'Door switch', why: 'No reading for it comes from the Visualization' },
    { id: 'u2', rule: 'Inlet flow totaliser not counting', eqTag: 'Inlet', reading: 'Flow totaliser', why: 'Reads a connection, not a piece of equipment: next phase' },
  ];
  function rules(key) {
    const al = arr(safe(() => V().alerts(key), [])).filter((a) => a.state !== 'draft');
    const mapped = [], newCover = [];
    al.forEach((a) => {
      if (NO_RULE.test(a.name)) newCover.push({ alertId: a.id, alertName: a.name, eqTag: a.eqTag });
      else mapped.push({ rule: `${a.eqTag} ${a.sensorName} ${a.dir === 'below' ? 'low' : 'high'}`, alertId: a.id, alertName: a.name, eqTag: a.eqTag, reading: a.sensorName, dir: a.dir, state: a.state });
    });
    return { mapped, unmapped: al.length ? UNMAPPED.slice() : [], newCover };
  }

  function rows(key) {
    const P = PS(key); const s0 = since(key); if (!P || s0 == null || !has(key)) return [];
    const to = until(key); const st = store(key); const r = rules(key); const byAlert = {}; r.mapped.forEach((m) => { byAlert[m.alertId] = m; });
    const names = {}; arr(safe(() => V().alerts(key), [])).forEach((a) => { names[a.id] = a; });
    const out = [];
    arr(P.trialLog).filter((x) => x.start >= s0 && x.start <= to).forEach((x) => {
      const a = names[x.alertId]; if (!a) return; const m = byAlert[x.alertId]; const id = `${x.alertId}@${x.start}`;
      const ctl = x.firstBand || x.band; let legacy = null; let outcome = 'ctl'; let lAt = null;
      if (m) {
        const h = hash(id) % 20;
        if (h === 0) { legacy = null; outcome = 'ctl'; }
        else if (h === 1) { const up = RANK[ctl] < 4 && (hash(id + 'u') % 2 === 0); legacy = BY_RANK[RANK[ctl] + (up ? 1 : RANK[ctl] > 1 ? -1 : 1)]; outcome = 'severity'; lAt = x.start + ((h % 5) - 2) * 3 * MIN; }
        else { legacy = ctl; outcome = 'matched'; lAt = x.start + ((h % 5) - 2) * 3 * MIN; }
      }
      out.push({ id, at: x.start, legacyAt: lAt, alertId: x.alertId, eqTag: a.eqTag, reading: a.sensorName, what: a.name, ctl, legacy, outcome, mapped: !!m });
    });
    /* what only legacy raised: a possible miss */
    const span = to - s0; const mp = r.mapped;
    const pick = (re) => mp.find((m) => re.test(m.alertName)) || mp[0] || null;
    const only = [
      { n: 1, f: 0.21, band: 'minor', un: UNMAPPED[0] },
      { n: 2, f: 0.40, band: 'major', m: pick(/Motor current high.*BL|Motor current/i) },
      { n: 3, f: 0.62, band: 'caution', un: UNMAPPED[1] },
      { n: 4, f: 0.74, band: 'minor', m: pick(/pH high/i) },
    ];
    if (span > 2 * DAY) only.forEach((o) => {
      const at = s0 + Math.round((o.f * Math.min(span, 6 * DAY)) / (15 * MIN)) * 15 * MIN; if (at > to) return;
      if (o.un) out.push({ id: `L@${o.n}`, at, legacyAt: at, alertId: null, eqTag: o.un.eqTag, reading: o.un.reading, what: o.un.rule, ctl: null, legacy: o.band, outcome: 'legacy', mapped: false });
      else if (o.m) out.push({ id: `L@${o.n}`, at, legacyAt: at, alertId: o.m.alertId, eqTag: o.m.eqTag, reading: o.m.reading, what: o.m.rule, ctl: null, legacy: o.band, outcome: 'legacy', mapped: true });
    });
    out.forEach((x) => {
      const rs = st.reasons[x.id] || null; const R = rs ? reasonOf(rs.reason) : null;
      x.reason = rs ? rs.reason : null; x.reasonLabel = R ? R.label : null; x.note = rs ? rs.note || '' : ''; x.by = rs ? rs.by : null; x.reasonAt = rs ? rs.at : null; x.fixed = !!(rs && rs.fixedAt); x.fixedAt = rs ? rs.fixedAt || null : null;
      const serious = x.outcome === 'legacy' ? RANK[x.legacy] >= 3 : x.outcome === 'severity' ? (RANK[x.ctl] < RANK[x.legacy] && RANK[x.legacy] >= 3) : false;
      x.serious = serious; x.needsReason = x.outcome !== 'matched' && !rs;
      x.blocks = serious && (!rs || (R && R.fix && !rs.fixedAt));
    });
    return out.sort((a, b) => b.at - a.at);
  }

  function days(key) {
    const s0 = since(key); if (s0 == null) return []; const v = V(); const m = new Map();
    rows(key).forEach((x) => { const d = v.fmtDay(x.at); if (!m.has(d)) m.set(d, { day: d, at: x.at, ctl: 0, legacy: 0, matched: 0, differ: 0 }); const o = m.get(d); if (x.ctl) o.ctl++; if (x.legacy) o.legacy++; if (x.outcome === 'matched') o.matched++; else o.differ++; });
    return [...m.values()];
  }

  function gate(key) {
    if (!has(key)) return null; const s0 = since(key); const st = store(key); const to = until(key);
    const d = s0 == null ? 0 : Math.max(0, (to - s0) / DAY); const rs = rows(key);
    const unexplained = rs.filter((x) => x.blocks).length; const toReason = rs.filter((x) => x.needsReason).length;
    const sinceFix = st.lastFixAt != null ? (to - st.lastFixAt) / DAY : null;
    const okDays = d >= NEED_DAYS; const okFix = sinceFix == null || sinceFix >= AFTER_FIX_DAYS; const pass = okDays && okFix && unexplained === 0;
    const parts = [];
    if (!okDays) parts.push(s0 == null ? 'the shadow run has not started: it starts when alerts go On trial' : `day ${Math.floor(d) + 1} of ${NEED_DAYS}`);
    if (unexplained) parts.push(`${unexplained} Major or Emergency ${unexplained === 1 ? 'firing' : 'firings'} that CloseTheLoop missed or rated lower ${unexplained === 1 ? 'is' : 'are'} not explained`);
    if (okDays && !okFix) parts.push(`${Math.ceil(AFTER_FIX_DAYS - sinceFix)} more ${Math.ceil(AFTER_FIX_DAYS - sinceFix) === 1 ? 'day' : 'days'} needed after the last configuration fix`);
    return { since: s0, days: d, need: NEED_DAYS, unexplained, toReason, sinceFix, needAfterFix: AFTER_FIX_DAYS, pass, parts, text: pass ? `${Math.floor(d)} days of shadow, every difference that matters explained` : parts.join('; '), total: rs.length, matched: rs.filter((x) => x.outcome === 'matched').length };
  }

  function saved(key, text, who) { const v = V(); if (v.touch) v.touch(); if (text) v.log(key, text, 'config'); else v.persist(); if (who && v.S.activity.length && text) v.S.activity[v.S.activity.length - 1].who = who; v.persist(); }
  function setReason(key, id, reasonId, note, who) {
    const R = reasonOf(reasonId); if (!R) return { ok: false, error: 'Choose a reason.' };
    const row = rows(key).find((x) => x.id === id); if (!row) return { ok: false, error: 'That firing is no longer in the list.' };
    if (R.fix && !String(note || '').trim()) return { ok: false, error: 'Say what needs fixing, so the next person can do it.' };
    const st = store(key); const me = safe(() => V().activity({ limit: 30 }).map((x) => x.who).find((w) => w && w !== 'Automatic'), 'You');
    st.reasons[id] = { reason: reasonId, note: String(note || '').trim(), by: who || me, at: V().now(), fixedAt: null };
    saved(key, `Shadow run: ${row.what} on ${row.eqTag}, ${V().fmt(row.at)}: ${R.label}${note ? ` · ${String(note).trim()}` : ''}`, who);
    return { ok: true };
  }
  function markFixed(key, id, who) {
    const st = store(key); const rs = st.reasons[id]; if (!rs || rs.reason !== 'gap') return { ok: false, error: 'Only a real gap is marked fixed.' };
    const row = rows(key).find((x) => x.id === id); rs.fixedAt = V().now(); st.lastFixAt = rs.fixedAt;
    saved(key, `Shadow run: the gap behind ${row ? `${row.what} on ${row.eqTag}` : 'a firing'} is fixed in the configuration. The trial is replayed with today's limits; go live needs ${AFTER_FIX_DAYS} more days of shadow from now`, who);
    return { ok: true };
  }

  W.V7SHADOW = { has, open, since, rules, rows, days, gate, setReason, markFixed, REASONS, NEED_DAYS, AFTER_FIX_DAYS, PAIR_MIN };

  /* ── the page ─────────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; const PL = W.V7PLANT; if (!U || !PL || !U.route) return;
  const esc = U.esc; const btn = U.btn, card = U.card, chip = U.chip, note = U.note, sev = U.sev, table = U.table, filters = U.filters;
  const pl = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const OUT = { matched: ['Matched', 'muted'], severity: ['Severity differs', 'warn'], ctl: ['CloseTheLoop only', 'info'], legacy: ['Legacy only', 'bad'] };
  const who = () => { const PZ = W.V7PERSONA; return PZ && PZ.isAll && !PZ.isAll() ? PZ.title() : undefined; };
  function meter(label, value, of, ok, sub) {
    const pct = Math.max(0, Math.min(100, of ? Math.round(100 * value / of) : (ok ? 100 : 0)));
    return `<div class="sh-m${ok ? ' is-ok' : ''}"><div class="sh-m-h"><b>${esc(label)}</b><span>${esc(sub)}</span></div><div class="sh-m-bar" role="img" aria-label="${esc(label)}: ${esc(sub)}"><i style="width:${pct}%"></i></div></div>`;
  }
  function gateCard(key, g) {
    const d = g.days >= g.need ? g.need : Math.min(g.need, Math.floor(g.days) + 1);
    const body = `<div class="sh-gate">${meter('Days of shadow', d, g.need, g.days >= g.need, g.since == null ? 'Not started' : g.days >= g.need ? `${g.need} of ${g.need}` : `Day ${d} of ${g.need}`)}`
      + meter('Major or Emergency that CloseTheLoop missed or rated lower, not explained', g.unexplained ? 0 : 1, 1, g.unexplained === 0, g.unexplained ? `${g.unexplained} left: must be 0` : 'None left')
      + (g.sinceFix != null ? meter('Days since the last configuration fix', Math.min(g.needAfterFix, Math.floor(g.sinceFix)), g.needAfterFix, g.sinceFix >= g.needAfterFix, `${Math.min(g.needAfterFix, Math.floor(g.sinceFix))} of ${g.needAfterFix}`) : '') + '</div>'
      + `<p class="sh-cut">At go live the alerting ${esc(V().plantName(key))} has today is switched off, every record still open there moves across, and calls, the hooter and tasks start here. Until then people act on the alerting they have today, and nothing is sent from here.</p>`;
    return card({ title: g.pass ? 'The gate before go live is through' : 'The gate before go live', sub: g.pass ? `${Math.floor(g.days)} days of shadow, and nothing that matters is left unexplained.` : `Go live is held: ${g.text}.`, body, tone: g.pass ? null : 'warn', cls: 'sh-card' });
  }
  function reasonCell(key, x) {
    if (x.outcome === 'matched') return '<span class="muted">None needed</span>';
    if (!x.reason) return btn('Give a reason', { act: 'sh:reason', data: { plant: key, id: x.id }, small: true, kind: x.serious ? 'primary' : 'secondary' }) + (x.serious ? ` ${chip('Holds go live', { tone: 'bad' })}` : '');
    const R = reasonOf(x.reason);
    return `<span>${esc(R ? R.label : x.reason)}${x.note ? `<span class="p7-sub">${esc(x.note)}</span>` : ''}<span class="p7-sub">${esc(x.by || '')}${x.reasonAt ? ` · ${esc(V().fmt(x.reasonAt))}` : ''}</span></span>`
      + (R && R.fix ? (x.fixed ? ` ${chip('Fixed', { tone: 'muted' })}` : ` ${btn('Mark it fixed', { act: 'sh:fixed', data: { plant: key, id: x.id }, small: true })}${x.serious ? ` ${chip('Holds go live until fixed', { tone: 'bad' })}` : ''}`) : '')
      + ` ${btn('Change', { act: 'sh:reason', data: { plant: key, id: x.id }, small: true, kind: 'ghost' })}`;
  }
  function listCard(key, all, show) {
    const b = `#/p/${encodeURIComponent(key)}/shadow`; const need = all.filter((x) => x.needsReason || x.blocks); const diff = all.filter((x) => x.outcome !== 'matched'); const matched = all.filter((x) => x.outcome === 'matched');
    const list = show === 'all' ? all : show === 'matched' ? matched : show === 'diff' ? diff : need;
    const fl = filters([
      { label: 'Needs a reason', href: `${b}`, on: show === 'need', count: need.length },
      { label: 'Every difference', href: `${b}?show=diff`, on: show === 'diff', count: diff.length },
      { label: 'Matched', href: `${b}?show=matched`, on: show === 'matched', count: matched.length },
      { label: 'All', href: `${b}?show=all`, on: show === 'all', count: all.length },
    ]);
    const cap = 60; const shown = list.slice(0, cap);
    const t = table({
      cols: [
        { label: 'When', render: (x) => esc(V().fmt(x.at)) },
        { label: 'Equipment and reading', render: (x) => `<b class="mono">${esc(x.eqTag)}</b> ${esc(x.reading)}<span class="p7-sub">${esc(x.what)}${x.mapped ? '' : x.ctl ? ' · no legacy rule' : ' · no alert here'}</span>` },
        { label: 'CloseTheLoop', render: (x) => (x.ctl ? sev(x.ctl) : '<span class="muted">Nothing</span>') },
        { label: 'Legacy', render: (x) => (x.legacy ? sev(x.legacy) : '<span class="muted">Nothing</span>') },
        { label: 'Outcome', render: (x) => chip(OUT[x.outcome][0], { tone: OUT[x.outcome][1] }) },
        { label: 'Reason', render: (x) => reasonCell(key, x) },
      ],
      rows: shown, empty: show === 'need' ? 'Every difference has a reason.' : 'Nothing in this list yet.',
    });
    return card({ title: 'Both sides, firing by firing', sub: `Paired by equipment, reading and time: starts within ${PAIR_MIN} minutes of each other, widened by how long the alert must hold. Sample data.`, body: fl + t + (list.length > cap ? `<p class="small muted mt">The newest ${cap} of ${list.length} are shown.</p>` : ''), cls: 'sh-card' });
  }
  function daysCard(key) {
    const ds = W.V7SHADOW.days(key); if (!ds.length) return '';
    return card({ title: 'Day by day', body: table({ cols: [{ label: 'Day', key: 'day' }, { label: 'CloseTheLoop', key: 'ctl' }, { label: 'Legacy', key: 'legacy' }, { label: 'Matched', key: 'matched' }, { label: 'Differences', render: (d) => (d.differ ? `<b>${d.differ}</b>` : '0') }], rows: ds }), cls: 'sh-card p7-compact' });
  }
  function rulesCard(key) {
    const r = rules(key); if (!r.mapped.length && !r.newCover.length) return card({ title: 'The rules the plant has today', sub: 'They are matched to alerts here once alerts are accepted.', tone: 'quiet', cls: 'sh-card p7-compact' });
    const K = W.V7KEEP || { open: () => '' };
    const li = (a, b2) => `<li><span>${a}</span><span class="muted">${b2}</span></li>`;
    const body = `<div class="sh-rules">`
      + (r.unmapped.length ? `<div><h3>${pl(r.unmapped.length, 'legacy rule')} with no alert here</h3><ul class="sh-ul">${r.unmapped.map((u) => li(esc(u.rule), esc(u.why))).join('')}</ul></div>` : '')
      + (r.newCover.length ? `<div><h3>${pl(r.newCover.length, 'alert')} here with no legacy rule</h3><ul class="sh-ul">${r.newCover.map((u) => li(`<a href="#/p/${esc(encodeURIComponent(key))}/alert/${esc(encodeURIComponent(u.alertId))}">${esc(u.alertName)}</a>`, 'New coverage: its firings show as CloseTheLoop only')).join('')}</ul></div>` : '')
      + `</div><details class="lvl-out" data-keep="sh:map:${esc(key)}"${K.open(`sh:map:${key}`, false)}><summary>${pl(r.mapped.length, 'legacy rule')} matched to an alert here</summary><ul class="sh-ul">${r.mapped.map((m) => li(esc(m.rule), `<a href="#/p/${esc(encodeURIComponent(key))}/alert/${esc(encodeURIComponent(m.alertId))}">${esc(m.alertName)}</a>`)).join('')}</ul></details>`;
    return card({ title: 'The rules the plant has today, and the alerts that take them over', sub: 'Matched by equipment, reading and direction. A rule with no alert is named, never dropped silently.', body, cls: 'sh-card' });
  }
  function page(params) {
    const key = params && params.plant; const p = safe(() => V().plant(key), null); if (!p) return PL.frame(key, 'shadow', '');
    const q = (params && params._q) || {}; const show = ['all', 'matched', 'diff'].includes(q.show) ? q.show : 'need';
    if (!has(key)) return PL.frame(key, 'shadow', card({ title: 'No shadow run at this plant', sub: `${p.name} has no alerting today, so there is nothing to run beside. It goes live once its set-up is done.`, tone: 'quiet' }), { crumbs: [{ label: 'Shadow run' }] });
    const g = gate(key); const all = rows(key);
    const closed = p.state === 'live' || p.wasLive;
    const head = closed ? note(`The shadow run closed when ${esc(p.name)} went live${p.wentLive ? ` (${esc(p.wentLive.who)}, ${esc(V().fmt(p.wentLive.at))})` : ''}. This is its record.`, 'quiet') : '';
    const body = head + (closed ? '' : gateCard(key, g)) + (g.since == null ? card({ title: 'Nothing to compare yet', sub: 'The shadow run starts when the first alert goes On trial. From then on every firing on either side lands here.', tone: 'quiet', cls: 'sh-card' }) : listCard(key, all, show) + daysCard(key)) + rulesCard(key);
    return PL.frame(key, 'shadow', body, { crumbs: [{ label: 'Shadow run' }] });
  }
  function openReason(key, id) {
    const x = rows(key).find((r) => r.id === id); if (!x) { U.toast('That firing is no longer in the list.'); return; }
    const opts = REASONS.map((r) => `<label class="sh-r"><input type="radio" name="sh-reason" value="${esc(r.id)}"${x.reason === r.id ? ' checked' : ''}> <span>${esc(r.label)}</span></label>`).join('');
    const what = x.outcome === 'legacy' ? `Legacy raised ${V().bandLabel(x.legacy)}; CloseTheLoop raised nothing.` : x.outcome === 'ctl' ? `CloseTheLoop raised ${V().bandLabel(x.ctl)}; legacy raised nothing.` : `CloseTheLoop raised ${V().bandLabel(x.ctl)}; legacy raised ${V().bandLabel(x.legacy)}.`;
    const body = `<p><b>${esc(x.what)}</b> on <span class="mono">${esc(x.eqTag)}</span>, ${esc(V().fmt(x.at))}. ${esc(what)}</p><div class="sh-rs" role="radiogroup" aria-label="Reason">${opts}</div>`
      + U.field({ label: 'Note', hint: 'Needed for a real gap: say what to fix.', html: `<textarea id="sh-note" placeholder="For example: legacy fires at 28 A, the library limit is 32 A">${esc(x.note || '')}</textarea>` });
    U.modal({ title: 'Why the two sides differ', body, foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Save the reason', { act: 'sh:reason-save', data: { plant: key, id }, kind: 'primary' }) });
  }
  U.on('sh:reason', (el) => { openReason(el.getAttribute('data-plant'), el.getAttribute('data-id')); return false; });
  U.on('sh:reason-save', (el) => {
    const key = el.getAttribute('data-plant'); const id = el.getAttribute('data-id');
    const pick = document.querySelector('input[name="sh-reason"]:checked'); const ta = document.getElementById('sh-note');
    if (!pick) { U.toast('Choose a reason.'); return false; }
    const r = setReason(key, id, pick.value, ta ? ta.value : '', who());
    if (!r.ok) { U.toast(r.error); if (ta) ta.focus(); return false; }
    U.closeModal(true); U.toast('Reason saved. It is kept in Activity.'); return undefined;
  });
  U.on('sh:fixed', (el) => { const r = markFixed(el.getAttribute('data-plant'), el.getAttribute('data-id'), who()); U.toast(r.ok ? `Marked fixed. Go live needs ${AFTER_FIX_DAYS} more days of shadow from now.` : r.error); return undefined; });
  U.route('p/:plant/shadow', page);
})();
