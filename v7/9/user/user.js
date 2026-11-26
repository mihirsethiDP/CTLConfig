/* v7/9 · user/user.js — what a plant's people see on the phone, drawn from what the configuration console set up.
   Nothing here is typed in by hand for a screen: the unit processes, the equipment and its criticality, the tasks and their flows,
   the limits an alert fires on, who is told and when, and the root causes with their fix flows are all read from the same saved
   state the console writes (same browser, same origin). Accept a task in the console and it appears here; change a limit, a
   timeline or the flow a task follows and these screens change with it.
   What a person does on these screens (ticking a step, picking a cause) is kept on this page only. It is never written back.
   The plant shown is DigitalPaani. While it is still being set up nothing is sent to anyone, so due times, the firing reading and
   who is on an issue are sample values, and the page says so.
   window.USER = { vm, mount(el, state, opts), presets } */
(function () {
  'use strict';
  const W = window; const KEY = 'digitalpaani';
  const V = () => W.V7; const C = () => W.CTL;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, d) => { try { const r = fn(); return r == null ? d : r; } catch (e) { return d; } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  const TIER = { A: 'Critical', B: 'Essential', C: 'Standard' };
  const KIND = { routine: 'Routine check', work: 'Routine work', test: 'Manual testing', pm: 'Preventive maintenance', calibration: 'Calibration', condition: 'Condition-based' };
  const BANDS = ['caution', 'minor', 'major', 'emergency'];
  const SEV_RANK = { emergency: 0, major: 1, minor: 2, caution: 3 };

  /* ── language ─────────────────────────────────────────────────────────────────────────────────────────── */
  const LANGS = safe(() => W.V7LANG.LANGS, null) || [{ id: 'en', name: 'English', own: 'English' }];
  const SHORT = { en: 'EN', hi: 'हि', mr: 'म', ta: 'த' };
  const IX = { hi: 0, mr: 1, ta: 2 };
  const globalLang = () => { const l = safe(() => W.V7LANG.cur(), 'en'); return LANGS.some((x) => x.id === l) ? l : 'en'; };
  function word(text, lang) {
    if (lang === 'en') return text; const d = (W.US_WORDS || {})[text]; if (d && d[IX[lang]]) return d[IX[lang]];
    const t = safe(() => W.V7LANG.t(text, lang), null); return t == null ? null : t;
  }
  function speaker(lang) {
    const U = (W.US_UNITS || {})[lang] || (W.US_UNITS || {}).en; const o = { lang, miss: 0 };
    /* the screen's own words: always translated; {name} is filled with ready HTML */
    o.T = (text, vars) => { let s = word(text, lang); if (s == null) s = text; s = esc(s); if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); }); return s; };
    /* a name or a sentence that comes from the set-up: shown in English and marked where no translation exists yet */
    /* the same, for a phrase that starts a line: its first letter is raised after it is translated */
    o.NC = (text) => { if (text == null || text === '') return ''; const s = word(String(text), lang); if (s == null) { if (lang === 'en') return esc(cap(text)); o.miss++; return `<span class="us-en" lang="en">${esc(cap(text))}</span>`; } return esc(cap(s)); };
    o.N = (text) => { if (text == null || text === '') return ''; const s = word(String(text), lang); if (s == null) { if (lang === 'en') return esc(text); o.miss++; return `<span class="us-en" lang="en">${esc(text)}</span>`; } return esc(s); };
    const unit = (n, u) => `${n} ${esc(U[u][n === 1 ? 0 : 1])}`;
    o.durMin = (m) => { m = Math.max(1, Math.round(m)); if (m < 60) return unit(m, 'min'); const h = m / 60; if (h >= 48 && Math.round(h) % 24 === 0) return unit(Math.round(h) / 24, 'day'); if (Math.round(h) === 24) return unit(1, 'day'); const hh = Math.floor(h); const mm = m - hh * 60; return unit(hh, 'hour') + (mm && hh < 6 ? ' ' + unit(mm, 'min') : ''); };
    o.dur = (h) => o.durMin(h * 60);
    o.every = (ev, fallback) => { if (!ev || !U[ev.unit]) return o.N(fallback || ''); const n = +ev.n || 1; return n === 1 ? esc(U.every1[ev.unit]) : esc(U.every).replace('{n}', n).replace('{u}', esc(U[ev.unit][1])); };
    return o;
  }

  /* ── what the console set up, read once ───────────────────────────────────────────────────────────────── */
  function build() {
    const v = V(); const out = { ok: !!v };
    if (!v) return out;
    const plants = arr(safe(() => v.plants(), [])); const P = plants.find((p) => p.key === KEY) || { key: KEY, name: 'DigitalPaani', state: 'commissioning', type: 'STP' };
    out.plant = { name: P.name, state: safe(() => v.state(KEY), P.state), type: P.type || 'STP' };
    const st = safe(() => v.structure(KEY), null) || { ups: [], cgs: [], unplaced: [] };
    const eqs = arr(safe(() => v.equipment(KEY), [])); const eqBy = {}; eqs.forEach((e) => { eqBy[e.id] = e; });
    const sens = arr(safe(() => v.sensors(KEY), [])); const RD = W.READINGS || {};
    const flows = arr(safe(() => C().S.lib.flows, [])); const flowById = (id) => (id ? flows.find((f) => f.id === id) || null : null);
    const CR = W.V7CRIT; const SV = W.V7SEV;
    const tierOf = (id) => (eqBy[id] && eqBy[id].tier ? eqBy[id].tier : null);
    const ups = arr(st.ups); const home = {};
    ups.forEach((u) => { if (!home[u.id]) home[u.id] = u.id; }); ups.forEach((u) => arr(u.members).forEach((m) => { if (!home[m.eqId]) home[m.eqId] = u.id; }));
    const sensOf = (ids) => sens.filter((s) => ids.includes(s.eqId)).map((s) => ({ id: s.id, tag: s.tag, name: s.name, unit: s.unit || '', kind: s.kind, v: s.latest ? s.latest.v : null, eqTag: s.eqTag, onPipe: !!s.nextPhase || (RD[s.name] || {}).where === 'connection' }));
    const eqRow = (id) => { const e = eqBy[id]; return e ? { id, tag: e.tag, name: e.name, typeName: e.typeName, tier: e.tier || null } : null; };
    out.ups = ups.map((u) => { const mem = [...new Set(arr(u.members).map((m) => m.eqId))].filter((id) => id !== u.id && eqBy[id]); const ids = [u.id].concat(mem);
      return { id: u.id, tag: u.tag, name: u.name, typeName: u.typeName, tier: safe(() => CR.upTier(KEY, u.id).tier, null) || tierOf(u.id), self: eqRow(u.id), eq: mem.map(eqRow).filter(Boolean), ids, sensors: sensOf(ids) }; });
    const placed = new Set([].concat(...out.ups.map((u) => u.ids))); const looseIds = eqs.filter((e) => !placed.has(e.id)).map((e) => e.id);
    out.loose = { id: '@loose', tag: '', name: '', typeName: '', tier: null, self: null, eq: looseIds.map(eqRow), ids: looseIds, sensors: sensOf(looseIds) };
    out.upOf = (id) => (id === '@loose' ? out.loose : out.ups.find((u) => u.id === id) || null);
    out.homeOf = (eqId) => home[eqId] || (looseIds.includes(eqId) ? '@loose' : null);
    out.eq = eqRow; out.flowById = flowById; out.eqCount = eqs.length;
    out.crit = (tier) => safe(() => CR.plant(KEY, tier), null) || { remind: 4, repeat: 8, lead: 24, senior: 48 };
    out.sev = (band) => (band === 'caution' ? null : safe(() => SV.plant(KEY, band), null) || { start: 8, fix: 24, repeat: 8 });
    out.who = (band) => safe(() => SV.WHO[band], null) || { now: '', start: '', fix: '', repeat: '' };
    out.unitOf = (reading) => (RD[reading] ? RD[reading].unit || '' : '');
    out.linkOf = (step) => { const x = step && step.link ? safe(() => C().linkTarget(step.link), null) : null; if (!x) return null; const f = flowById(x.flow); return { name: x.name, steps: f ? arr(f.steps) : [] }; };
    out.fmtVal = (val, unit, kind) => safe(() => v.fmtVal(val, unit, kind), `${val}${unit ? ' ' + unit : ''}`);

    /* tasks: every line the plant has accepted from the library; until one is accepted, the lines the library drafts for it */
    const lr = arr(safe(() => v.libraryReview(KEY), [])); const props = [].concat(...lr.map((r) => arr(r.proposals)));
    const tp = props.filter((p) => p.kind === 'task' && !p.blockedBy && p.decided !== 'rejected');
    const accT = tp.filter((p) => p.decided === 'accepted'); const use = accT.length ? accT : tp; const LF = W.V7LIBFLOW;
    const flowForTask = (p) => {
      if (p.eqId === 'plant' || p.pipeCal) { const prof = (W.PLANT_PROFILES || {})[out.plant.type] || (W.PLANT_PROFILES || {}).STP; const r = prof ? arr(prof.rounds).find((x) => x.name === p.name) : null; return flowById(r && r.flow); }
      const e = eqBy[p.eqId]; const code = e ? e.code || e.dbType : null; let f = code && LF ? safe(() => LF.flowOf('task', code, p.name), null) : null;
      if (!f && LF) { const u = ups.find((x) => x.id === p.eqId); if (u) f = safe(() => LF.flowOf('task', u.typeId, p.name), null); }
      return f ? flowById(f.id) || f : null;
    };
    const groups = new Map();
    use.forEach((p) => { const shared = p.eqId !== 'plant' && ['routine', 'work', 'test'].includes(p.workType); const k = shared ? `${p.typeName}|${p.name}` : p.pid; let g = groups.get(k);
      if (!g) { g = { name: p.name, wt: p.workType, every: p.every || null, everyText: p.everyText || '', basis: p.basis || 'calendar', eqIds: [], plantLevel: p.eqId === 'plant', p0: p }; groups.set(k, g); }
      if (p.eqId !== 'plant') g.eqIds.push(p.eqId); });
    let n = 0;
    out.tasks = [...groups.values()].map((g) => { const tiers = g.eqIds.map(tierOf).filter(Boolean).sort();
      return { id: 't' + (n++), name: g.name, wt: KIND[g.wt] ? g.wt : 'pm', every: g.every, everyText: g.everyText, basis: g.basis, eqIds: g.eqIds, tags: g.eqIds.map((id) => (eqBy[id] ? eqBy[id].tag : '')).filter(Boolean), plantLevel: g.plantLevel, tier: tiers[0] || null, upId: g.eqIds.length ? out.homeOf(g.eqIds[0]) : null, flow: flowForTask(g.p0), today: null }; });
    const hasTr = (f) => safe(() => W.V7LANG.flowState(f.id, 'hi') !== 'none', false);
    const score = (t) => { if (!t.flow) return -1; const s = arr(t.flow.steps); return (hasTr(t.flow) ? 8 : 0) + (s.some((x) => x.type === 'reading') ? 4 : 0) + (s.some((x) => x.photo) ? 2 : 0) + (s.some((x) => x.type === 'wait' || x.type === 'question') ? 1 : 0); };
    const demo = out.tasks.slice().sort((a, b) => score(b) - score(a))[0] || null;
    const late = out.tasks.filter((t) => t !== demo && t.flow && t.tier).sort((a, b) => (a.tier < b.tier ? -1 : a.tier > b.tier ? 1 : 0))[0] || null;
    const hash = (s) => { let h = 7; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0; return h; };
    const days = (ev) => (ev ? ({ hour: 1, day: 1, week: 7, month: 30, year: 365 }[ev.unit] || 30) * (+ev.n || 1) : 30);
    const rest = out.tasks.filter((t) => t !== demo && t !== late && hash(t.name + '|' + t.tags.join(',')) % Math.max(1, Math.round(days(t.every))) === 0).slice(0, 6);
    const now = safe(() => v.now(), Date.now()); const hhmm = (ms) => { const d = new Date(ms + 330 * 60000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
    out.clock = hhmm(now);
    if (late) late.today = { state: 'overdue', lateH: out.crit(late.tier).lead + 1 };
    if (demo) demo.today = { state: 'now', at: hhmm(now) };
    rest.forEach((t, i) => { t.today = { state: 'later', at: hhmm(now + (i + 1) * 75 * 60000) }; });
    out.demoTask = demo; out.lateTask = late;
    out.today = [late, demo].concat(rest).filter(Boolean);
    out.counts = { tasks: tp.length, tasksAccepted: accT.length, taskLines: use.length };

    /* tasks that come on a condition, not on a date */
    const UA = W.V7UPALERT; const offers = arr(safe(() => UA.offers(KEY), []));
    out.conds = offers.filter((o) => !o.skipped && o.state !== 'left' && o.starts && o.starts.kind !== 'issue').map((o) => { const f = flowById(o.starts.flowId); return { name: f ? f.name : o.name, cond: o.name, sentence: safe(() => UA.sentence(null, o), ''), band: o.band, upTag: o.upTag, applied: o.state === 'applied', hold: o.hold }; });

    /* issues: one from a limit on a reading, one from several readings together, one a person reported */
    const causes = arr(safe(() => C().S.lib.causes, [])); const causeBy = (id) => causes.find((c) => c.id === id) || null;
    const causeList = (flowId, typeId) => { const ids = []; const f = flowById(flowId); if (f) arr(f.steps).forEach((s) => Object.values(s.answers || {}).forEach((x) => { if (x && x.t === 'cause' && !ids.includes(x.id)) ids.push(x.id); }));
      const it = typeId ? arr(W.ISSUES).find((q) => q.id === typeId) : null; arr(it && it.causes).forEach((id) => { if (!ids.includes(id)) ids.push(id); });
      return ids.map(causeBy).filter(Boolean).map((c) => ({ id: c.id, name: c.name, fix: flowById(c.fix) })); };
    out.issues = [];
    const ap = props.filter((p) => p.kind === 'alert' && !p.blockedBy && p.decided !== 'rejected' && p.limits && p.limits.bands);
    out.counts.alerts = ap.length; out.counts.alertsAccepted = ap.filter((p) => p.decided === 'accepted').length;
    const cands = ap.map((p) => { const e = eqBy[p.eqId]; const lt = e ? safe(() => v.libType(e.code || e.dbType), null) : null; const la = lt ? arr(lt.alerts).find((x) => x.name === p.name) : null; const cs = la ? causeList(la.flowId, la.issueTypeId) : []; return { p, e, la, cs, nfix: cs.filter((c) => c.fix).length }; }).filter((x) => x.e && x.nfix >= 1);
    cands.sort((a, b) => ((b.p.decided === 'accepted') - (a.p.decided === 'accepted')) || (b.nfix - a.nfix));
    if (cands[0]) {
      const { p, e, la, cs } = cands[0]; const bands = p.limits.bands; const band = bands.major != null ? 'major' : ['minor', 'caution', 'emergency'].find((b) => bands[b] != null) || 'minor';
      const s = sens.find((x) => x.id === p.sensorId) || {}; const valid = arr(s.valid).length === 2 ? s.valid : [0, 100]; const limit = bands[band]; const below = p.dir === 'below';
      const stepV = Math.max(Math.abs(limit) * 0.012, (valid[1] - valid[0]) * 0.008, 0.1); const r1 = (x) => Math.round(x * 10) / 10;
      const inside = (x) => BANDS.every((b) => bands[b] == null || (below ? x > bands[b] : x < bands[b]));
      const cur = s.latest ? s.latest.v : null; const mid = BANDS.map((b) => bands[b]).filter((x) => x != null).reduce((a, b) => (below ? Math.max(a, b) : Math.min(a, b)));
      out.issues.push({ id: 'i1', src: 'limit', title: p.name, band, eqId: p.eqId, tag: e.tag, eqName: e.name, upId: out.homeOf(p.eqId), tier: e.tier || null, reading: p.reading, sTag: s.tag || '', unit: p.limits.unit || '', kindR: p.limits.kind || '', below, limit, val: r1(below ? limit - stepV : limit + stepV), okVal: cur != null && inside(cur) ? cur : r1(below ? mid + (valid[1] - mid) * 0.3 : mid - (mid - valid[0]) * 0.2), bands, valid, hold: la && la.hold != null ? la.hold : 5, causes: cs, openedMin: 12, who: null });
    }
    const xs = offers.filter((o) => !o.skipped && o.state !== 'left' && o.starts && o.starts.kind === 'issue' && o.starts.flowId).map((o) => ({ o, cs: causeList(o.starts.flowId, null) })).filter((x) => x.cs.some((c) => c.fix));
    xs.sort((a, b) => ((b.o.state === 'applied') - (a.o.state === 'applied')) || ((a.o.band in SEV_RANK ? SEV_RANK[a.o.band] : 9) - (b.o.band in SEV_RANK ? SEV_RANK[b.o.band] : 9)));
    out.counts.across = offers.filter((o) => !o.skipped && o.state !== 'left').length; out.counts.acrossApplied = offers.filter((o) => o.state === 'applied').length;
    if (xs[0]) { const { o, cs } = xs[0]; const sv = out.sev(o.band) || { start: 1 }; const isUp = ups.some((u) => u.id === o.upId);
      out.issues.push({ id: 'i2', src: 'across', title: o.name, band: o.band, eqId: eqBy[o.upId] ? o.upId : null, tag: o.upTag, eqName: o.upName || '', upId: isUp ? o.upId : out.homeOf(o.upId), tier: tierOf(o.upId) || (isUp ? safe(() => CR.upTier(KEY, o.upId).tier, null) : null), sentence: safe(() => UA.sentence(null, o), ''), hold: o.hold, causes: cs, openedMin: Math.round(sv.start * 60 + 20) }); }
    const prefer = (e) => (/blower/i.test(e.typeName) ? 0 : 1); let rep = null;
    eqs.slice().sort((a, b) => prefer(a) - prefer(b)).some((e) => arr(W.ISSUES).filter((q) => arr(q.homeTypes).includes(e.typeName)).some((it) => { const cs = causeList(it.flow, it.id); if (!cs.some((c) => c.fix && arr(c.fix.steps).some((s) => s.link))) return false; rep = { e, it, cs }; return true; }));
    if (rep) out.issues.push({ id: 'i3', src: 'reported', title: rep.it.name, band: 'minor', eqId: rep.e.id, tag: rep.e.tag, eqName: rep.e.name, upId: out.homeOf(rep.e.id), tier: rep.e.tier || null, causes: rep.cs, openedMin: 180 });
    out.problemsFor = (eqId) => { const e = eqBy[eqId]; if (!e) return []; const u = ups.find((x) => x.id === eqId); const names = [e.typeName, u && u.typeName].filter(Boolean); return arr(W.ISSUES).filter((q) => arr(q.homeTypes).some((t) => names.includes(t))).map((it) => ({ id: it.id, name: it.name, causes: causeList(it.flow, it.id) })); };
    out.reportIssue = (eqId, pr, k) => { const e = eqBy[eqId]; return { id: 'r' + k, src: 'reported', title: pr.name, band: 'minor', eqId, tag: e.tag, eqName: e.name, upId: out.homeOf(eqId), tier: e.tier || null, causes: pr.causes, openedMin: 0, mine: true }; };
    return out;
  }

  /* ── small pieces ─────────────────────────────────────────────────────────────────────────────────────── */
  const ICON = {
    back: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    issue: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.5M12 17.2v.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    task: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 12.5l2.4 2.4 4.6-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    report: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const sevChip = (L, band) => `<span class="us-sev us-sev-${esc(band)}">${L.T(cap(band))}</span>`;
  const critChip = (L, tier) => (tier && TIER[tier] ? `<span class="us-crit us-crit-${esc(tier)}" title="${L.T('Criticality')}">${L.T(TIER[tier])}</span>` : '');
  const kindChip = (L, wt) => `<span class="us-kind">${L.T(KIND[wt] || 'Task')}</span>`;
  const tag = (t) => (t ? `<span class="us-tag">${esc(t)}</span>` : '');
  const row = (act, data, main, right) => `<button type="button" class="us-row" data-act="${act}"${Object.keys(data || {}).map((k) => ` data-${k}="${esc(data[k])}"`).join('')}><span class="us-row-m">${main}</span><span class="us-row-r">${right || ''}${ICON.chev}</span></button>`;
  const agoText = (L, min) => (min <= 0 ? L.T('Now') : L.T('{t} ago', { t: L.durMin(min) }));
  const newRun = () => ({ started: false, i: 0, done: {}, val: {}, photo: {}, ans: {}, wait: {}, link: {}, fin: false });
  const stepOk = (s, R) => { if (!s) return true; if (s.photo === 'required' && !R.photo[s.id]) return false; if (s.type === 'reading') return R.val[s.id] !== '' && R.val[s.id] != null && isFinite(+R.val[s.id]); if (s.type === 'question') return !!R.ans[s.id]; if (s.type === 'wait') return !!R.wait[s.id]; return true; };
  const stepWhy = (L, s, R) => (s.photo === 'required' && !R.photo[s.id] ? L.T('A photo is needed for this step') : s.type === 'reading' ? L.T('Enter a number') : s.type === 'question' ? L.T('Answer yes or no') : s.type === 'wait' ? L.T('Wait until the time is up') : '');

  /* ── the screens ──────────────────────────────────────────────────────────────────────────────────────── */
  function App(el, S0, opts) {
    const VM = W.USER.vm; const I = { el, S: S0, opts: opts || {} };
    const S = () => I.S; const lang = () => S().lang || globalLang();
    const issues = () => VM.issues.concat(arr(S().added));
    const issueOf = (id) => issues().find((x) => x.id === id) || null;
    const ir = (id) => S().ir[id] || (S().ir[id] = { status: 'open', causeId: null, run: null });
    const trun = (id) => S().tr[id] || (S().tr[id] = newRun());
    const taskOf = (id) => VM.tasks.find((t) => t.id === id) || null;
    const openIssues = () => issues().filter((x) => !['closed', 'false', 'lead'].includes(ir(x.id).status)).sort((a, b) => (SEV_RANK[a.band] - SEV_RANK[b.band]) || (a.openedMin - b.openedMin));
    const todays = () => VM.today.filter((t) => !trun(t.id).fin);
    const route = () => S().stack[S().stack.length - 1];

    function whoLines(L, x) {
      const sv = VM.sev(x.band); const w = VM.who(x.band);
      if (!sv) return `<p class="us-quiet">${L.T('Shown in the app and the morning email. Nobody is reminded.')}</p>`;
      return `<ul class="us-tl"><li><b>${L.T('Not started in {t}', { t: L.dur(sv.start) })}</b><span>${L.NC(w.start)}</span></li><li><b>${L.T('Not fixed in {t}', { t: L.dur(sv.fix) })}</b><span>${L.NC(w.fix)}</span></li><li><b>${L.T('Then every {t}', { t: L.dur(sv.repeat) })}</b><span>${L.NC(w.repeat)}</span></li></ul>`;
    }
    function bandBar(x) {
      const lo = x.valid[0]; const hi = x.valid[1]; const span = hi - lo || 1; const pos = (val) => Math.max(0, Math.min(100, ((val - lo) / span) * 100));
      const set = BANDS.filter((b) => x.bands[b] != null); const segs = set.map((b, i) => { const a = x.bands[b]; const nx = set[i + 1] != null ? x.bands[set[i + 1]] : (x.below ? lo : hi); const l = pos(Math.min(a, nx)); const r = pos(Math.max(a, nx)); return `<span class="us-bb-s us-bb-${b}" style="left:${l}%;width:${Math.max(1.5, r - l)}%"></span>`; }).join('');
      return (val, cls) => `<div class="us-bb" aria-hidden="true">${segs}<span class="us-bb-v ${cls || ''}" style="left:${pos(val)}%"></span></div>`;
    }
    function firedHtml(L, x) {
      if (x.src === 'limit') {
        const line = L.T(x.below ? '{reading} is below its {band} limit' : '{reading} is above its {band} limit', { reading: `<b>${L.N(x.reading)}</b>`, band: L.T(cap(x.band)) });
        return `<p class="us-fired">${line}</p>${bandBar(x)(x.val)}<dl class="us-kv"><div><dt>${L.T('Now')}</dt><dd class="us-num">${esc(VM.fmtVal(x.val, x.unit, x.kindR))}</dd></div><div><dt>${L.T('Limit')}</dt><dd class="us-num">${esc(VM.fmtVal(x.limit, x.unit, x.kindR))}</dd></div></dl><p class="us-sub">${tag(x.sTag)} ${L.T('held for {t}', { t: L.durMin(x.hold || 1) })} <span class="us-sample">${L.T('Sample')}</span></p>`;
      }
      if (x.src === 'across') return `<p class="us-fired">${L.T('Several readings together')}</p><p class="us-cond">${L.N(x.sentence)}</p><p class="us-sub">${L.T('held for {t}', { t: L.durMin(x.hold || 1) })} <span class="us-sample">${L.T('Sample')}</span></p>`;
      return `<p class="us-fired">${L.T('Reported by a person')}</p>`;
    }
    function issueStatus(L, x) { const r = ir(x.id); if (r.status === 'open') return `${L.T('Not started')} · ${agoText(L, x.openedMin)}`; if (r.status === 'closed' || r.status === 'false' || r.status === 'lead') return L.T('Closed'); const f = r.causeId ? (x.causes.find((c) => c.id === r.causeId) || {}).fix : null; return L.T('You are on it') + (r.status === 'fixing' && f && r.run ? ` · ${L.T('Step {n} of {m}', { n: Math.min(r.run.i + 1, f.steps.length), m: f.steps.length })}` : ''); }
    const issueRow = (L, x) => row('issue', { id: x.id }, `<span class="us-row-t">${L.N(x.title)}</span><span class="us-row-s">${tag(x.tag)} ${critChip(L, x.tier)} · ${issueStatus(L, x)}</span>`, sevChip(L, x.band));
    function dueText(L, t) { const d = t.today; if (!d) return ''; if (trun(t.id).fin) return L.T('Done'); return d.state === 'overdue' ? `<span class="us-late">${L.T('late by {t}', { t: L.dur(d.lateH) })}</span>` : d.state === 'now' ? `<span class="us-now">${L.T('Due now')}</span>` : esc(d.at); }
    const where = (L, t) => (t.plantLevel ? L.T('The whole plant') : t.tags.length > 2 ? `${tag(t.tags[0])} ${L.T('On {n} pieces of equipment', { n: t.tags.length })}` : t.tags.map(tag).join(' '));
    const taskRow = (L, t) => row('task', { id: t.id }, `<span class="us-row-t">${L.N(t.name)}</span><span class="us-row-s">${kindChip(L, t.wt)} ${where(L, t)} ${critChip(L, t.tier)}</span>`, `<span class="us-due">${dueText(L, t)}</span>`);

    /* one step at a time: an instruction, a reading to enter, a yes/no check, a wait, a photo, or a step that is a task of its own */
    function runner(L, flow, R, o) {
      const st = arr(flow.steps); const n = st.length; const i = Math.max(0, Math.min(R.i || 0, n - 1)); const s = st[i]; const ok = stepOk(s, R); let ctl = '';
      if (s.type === 'reading') { const u = s.sensorKind ? VM.unitOf(s.sensorKind) : ''; ctl += `<label class="us-f"><span class="us-f-l">${L.T('Enter the reading')}${s.sensorKind ? ` · ${L.N(s.sensorKind)}` : ''}</span><span class="us-f-r"><input type="number" inputmode="decimal" step="any" data-in="val" data-sid="${esc(s.id)}" value="${esc(R.val[s.id] == null ? '' : R.val[s.id])}" aria-label="${L.T('Enter the reading')}">${u ? `<span class="us-unit">${esc(u)}</span>` : ''}</span></label>`; }
      if (s.type === 'question') ctl += `<div class="us-yn" role="group">${['Yes', 'No'].map((a) => `<button type="button" class="us-btn us-yn-b" data-act="ans" data-a="${a}" aria-pressed="${R.ans[s.id] === a}">${L.T(a)}</button>`).join('')}</div>`;
      if (s.type === 'wait') ctl += `<div class="us-wait"><span class="us-wait-n">${L.T('Wait {n} minutes', { n: esc(s.minutes || 1) })}</span><button type="button" class="us-btn" data-act="wait" aria-pressed="${!!R.wait[s.id]}">${R.wait[s.id] ? ICON.check + ' ' : ''}${L.T('Time is up')}</button></div>`;
      if (s.photo) ctl += `<div class="us-photo${R.photo[s.id] ? ' is-on' : ''}"><button type="button" class="us-btn" data-act="photo">${ICON.cam} ${R.photo[s.id] ? L.T('Photo added') : s.photo === 'required' ? L.T('Take a photo') : L.T('Photo (optional)')}</button>${R.photo[s.id] ? '<span class="us-thumb" aria-hidden="true"></span>' : ''}</div>`;
      const lk = VM.linkOf(s);
      if (lk) ctl += `<div class="us-link"><p class="us-link-h">${L.T('This step has its own task')}</p><p class="us-link-n">${L.N(lk.name)} · ${L.T('{n} steps', { n: lk.steps.length })}</p>${lk.steps.length ? `<button type="button" class="us-btn us-btn-q" data-act="link">${R.link[s.id] ? L.T('Hide its steps') : L.T('See its steps')}</button>${R.link[s.id] ? `<ol class="us-link-s">${lk.steps.map((q) => `<li>${L.N(q.text)}</li>`).join('')}</ol>` : ''}` : ''}</div>`;
      const all = `<details class="us-all"${S().open.all ? ' open' : ''} data-keep="all"><summary>${L.T('All steps')} · ${n}</summary><ol>${st.map((q, k) => `<li class="${k < i ? 'is-done' : k === i ? 'is-on' : ''}">${k < i ? ICON.check : ''}<span>${L.N(q.text)}</span></li>`).join('')}</ol></details>`;
      return `<div class="us-run"><div class="us-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${i}"><span style="width:${(i / n) * 100}%"></span></div><p class="us-stepn">${L.T('Step {n} of {m}', { n: i + 1, m: n })}</p><p class="us-step">${L.N(s.text)}</p>${ctl}<p class="us-why" data-why${ok ? ' hidden' : ''}>${stepWhy(L, s, R)}</p>`
        + `<div class="us-foot">${i > 0 ? `<button type="button" class="us-btn" data-act="prev">${L.T('Back')}</button>` : '<span></span>'}<button type="button" class="us-btn us-primary" data-act="next"${ok ? '' : ' disabled'}>${i < n - 1 ? L.T('Next') : o.finish}</button></div>${all}</div>`;
    }

    const SCREEN = {
      home(L) {
        const iss = openIssues(); const td = todays(); const over = td.filter((t) => t.today.state === 'overdue');
        const worst = iss[0] || null; const nextT = td[0] || null;
        const stat = (n, label, cls, act) => `<button type="button" class="us-stat ${cls}" data-act="nav" data-to="${act}"><b>${n}</b><span>${label}</span></button>`;
        const upRow = (u) => { const here = iss.filter((x) => x.upId === u.id); const due = td.filter((t) => t.upId === u.id).length; return row('up', { id: u.id }, `<span class="us-row-t">${tag(u.tag)} ${L.N(u.typeName)}</span><span class="us-row-s">${L.T('{n} equipment', { n: u.ids.length })} ${critChip(L, u.tier)}${due ? ` · ${L.T('Tasks today')}: ${due}` : ''}</span>`, here.length ? sevChip(L, here[0].band) : `<span class="us-ok">${L.T('Running normally')}</span>`); };
        return `<div class="us-stats">${stat(iss.length, L.T('Open issues'), worst ? 'is-' + worst.band : '', 'issues')}${stat(over.length, L.T('Overdue'), over.length ? 'is-late' : '', 'tasks')}${stat(td.length, L.T('Tasks today'), '', 'tasks')}</div>`
          + (worst || nextT ? `<h2 class="us-h">${L.T('Needs you now')}</h2><div class="us-list">${worst ? issueRow(L, worst) : ''}${nextT ? taskRow(L, nextT) : ''}</div>` : '')
          + `<h2 class="us-h">${L.T('{n} unit processes in flow order', { n: VM.ups.length })}</h2><div class="us-list">${VM.ups.map(upRow).join('')}${VM.loose.eq.length ? row('up', { id: '@loose' }, `<span class="us-row-t">${L.T('Other equipment')}</span><span class="us-row-s">${L.T('In no unit process')} · ${L.T('{n} equipment', { n: VM.loose.eq.length })}</span>`, '') : ''}</div>`;
      },
      lead(L) {
        const lateT = VM.today.filter((t) => t.today.state === 'overdue' && !trun(t.id).fin); const iss = openIssues().filter((x) => ir(x.id).status === 'open');
        const li = (cls, a, b, c) => `<li class="${cls}"><b>${a}</b><span class="us-tl-t">${b}</span><span>${c}</span></li>`;
        const tCard = (t) => { const c = VM.crit(t.tier); const h = t.today.lateH; const p = (x) => (h >= x ? 'is-past' : 'is-next');
          return `<article class="us-card"><header><span class="us-row-t">${L.N(t.name)}</span><span class="us-row-s">${where(L, t)} ${critChip(L, t.tier)} · <span class="us-late">${L.T('late by {t}', { t: L.dur(h) })}</span></span></header><ul class="us-tl us-tl-3">${li('is-past', L.T('When it was due'), '', L.T('The Operator sees it as due'))}${li(p(c.remind), L.T('First reminder'), L.T('after {t}', { t: L.dur(c.remind) }), L.T('The Operator is reminded'))}${li('is-rep', '', L.T('every {t}', { t: L.dur(c.repeat) }), L.T('The Operator is reminded again'))}${li(p(c.lead) + (h >= c.lead && h < c.senior ? ' is-you' : ''), L.T('Lead told'), L.T('after {t}', { t: L.dur(c.lead) }), '')}${li(p(c.senior), L.T('Senior Lead told'), L.T('after {t}', { t: L.dur(c.senior) }), '')}</ul><p class="us-sub">${L.T('The times follow its criticality: {tier}.', { tier: L.T(TIER[t.tier] || 'Standard') })}</p><div class="us-card-a"><button type="button" class="us-btn" data-act="remind" data-id="${t.id}"${S().reminded[t.id] ? ' disabled' : ''}>${S().reminded[t.id] ? L.T('Reminder sent') : L.T('Remind the Operator')}</button><button type="button" class="us-btn us-primary" data-act="task" data-id="${t.id}">${L.T('Open it')}</button></div></article>`; };
        const iCard = (x) => { const sv = VM.sev(x.band); const w = VM.who(x.band); const h = x.openedMin / 60; const p = (v) => (h >= v ? 'is-past' : 'is-next');
          return `<article class="us-card"><header><span class="us-row-t">${L.N(x.title)} ${sevChip(L, x.band)}</span><span class="us-row-s">${tag(x.tag)} ${critChip(L, x.tier)} · ${L.T('Not started')} · ${agoText(L, x.openedMin)}</span></header>${sv ? `<ul class="us-tl us-tl-3">${li('is-past', L.T('When it opens'), '', L.N(w.now))}${li(p(sv.start), L.T('Not started in {t}', { t: L.dur(sv.start) }), '', L.NC(w.start))}${li(p(sv.fix), L.T('Not fixed in {t}', { t: L.dur(sv.fix) }), '', L.NC(w.fix))}${li('is-rep', L.T('Then every {t}', { t: L.dur(sv.repeat) }), '', L.NC(w.repeat))}</ul><p class="us-sub">${L.T('The times follow its severity: {band}.', { band: L.T(cap(x.band)) })}</p>` : `<p class="us-quiet">${L.T('Shown in the app and the morning email. Nobody is reminded.')}</p>`}<div class="us-card-a"><span></span><button type="button" class="us-btn us-primary" data-act="issue" data-id="${x.id}">${L.T('Open it')}</button></div></article>`; };
        return `<h2 class="us-h">${L.T('Late tasks')}</h2>${lateT.length ? lateT.map(tCard).join('') : `<p class="us-quiet">${L.T('Nothing is late.')}</p>`}<h2 class="us-h">${L.T('Issues nobody has started')}</h2>${iss.length ? iss.map(iCard).join('') : `<p class="us-quiet">${L.T('Every issue has someone on it.')}</p>`}`;
      },
      up(L, id) {
        const u = VM.upOf(id); if (!u) return ''; const iss = openIssues().filter((x) => x.upId === u.id); const td = todays().filter((t) => t.upId === u.id);
        const eqs = (u.self ? [u.self] : []).concat(u.eq);
        return `<header class="us-pagehead">${u.id === '@loose' ? `<h2>${L.T('Other equipment')}</h2><p>${L.T('In no unit process')}</p>` : `<h2>${tag(u.tag)} ${L.N(u.typeName)}</h2><p>${L.T('Unit process')} · ${L.N(u.name)} ${critChip(L, u.tier)}</p>`}</header>`
          + `<h3 class="us-h">${L.T('Open here')}</h3>${iss.length ? `<div class="us-list">${iss.map((x) => issueRow(L, x)).join('')}</div>` : `<p class="us-quiet">${L.T('Nothing open here.')}</p>`}`
          + `<h3 class="us-h">${L.T('Due here')}</h3>${td.length ? `<div class="us-list">${td.map((t) => taskRow(L, t)).join('')}</div>` : `<p class="us-quiet">${L.T('Nothing is due here today.')}</p>`}`
          + `<h3 class="us-h">${L.T('Equipment')} · ${eqs.length}</h3><ul class="us-plain">${eqs.map((e) => `<li><span>${tag(e.tag)} ${L.N(e.typeName)}</span>${critChip(L, e.tier)}</li>`).join('')}</ul>`
          + `<h3 class="us-h">${L.T('Sensors')} · ${u.sensors.length}</h3>${u.sensors.length ? `<ul class="us-plain">${u.sensors.map((s) => `<li><span>${tag(s.tag)} ${L.N(s.name)}${s.onPipe ? ` <span class="us-pipe">${L.T('On a pipe')}</span>` : ''}</span><span class="us-num">${s.v == null ? '' : esc(s.kind === 'status' ? '' : VM.fmtVal(s.v, s.unit, s.kind))}${s.kind === 'status' && s.v != null ? L.T(+s.v ? 'ON' : 'OFF') : ''}</span></li>`).join('')}</ul>` : `<p class="us-quiet">${L.T('No sensors here.')}</p>`}`;
      },
      search(L) { return `<div class="us-searchbox"><span class="us-searchicon">${ICON.search}</span><input type="search" data-in="q" value="${esc(S().q)}" placeholder="${L.T('Plant, unit process or equipment')}" aria-label="${L.T('Search')}" autocomplete="off"></div><p class="us-strip">${L.T('Searching in {plant}', { plant: `<b>${esc(VM.plant.name)}</b>` })}</p><div class="us-res">${results(L)}</div>`; },
      issues(L) { const all = issues().slice().sort((a, b) => (SEV_RANK[a.band] - SEV_RANK[b.band])); const open = openIssues(); const closed = all.filter((x) => !open.includes(x)); return `<div class="us-list">${open.map((x) => issueRow(L, x)).join('')}</div>${open.length ? '' : `<p class="us-quiet">${L.T('No issue is open.')}</p>`}${closed.length ? `<h2 class="us-h">${L.T('Closed')}</h2><div class="us-list">${closed.map((x) => issueRow(L, x)).join('')}</div>` : ''}`; },
      issue(L, id) {
        const x = issueOf(id); if (!x) return ''; const r = ir(id); const cause = r.causeId ? x.causes.find((c) => c.id === r.causeId) : null;
        const head = `<header class="us-pagehead us-ih us-ih-${esc(x.band)}"><p class="us-ih-c">${sevChip(L, x.band)} <span>${agoText(L, x.openedMin)}</span></p><h2>${L.N(x.title)}</h2><p>${tag(x.tag)} ${L.N(x.eqName)} ${critChip(L, x.tier)}</p></header>`;
        if (r.status === 'open') return head + `<h3 class="us-h">${L.T('What fired')}</h3><div class="us-box">${firedHtml(L, x)}</div><h3 class="us-h">${L.T('Who was told')}</h3><div class="us-box"><p>${L.N(VM.who(x.band).now || '') || L.T('Shown in the app and the morning email. Nobody is reminded.')}</p></div><h3 class="us-h">${L.T('If it stays open')}</h3><div class="us-box">${whoLines(L, x)}</div><div class="us-foot us-foot-1"><button type="button" class="us-btn us-primary" data-act="i-start">${L.T('Start working on it')}</button></div><p class="us-alt"><button type="button" class="us-lnk" data-act="i-false">${L.T('Not a real problem')}</button></p>`;
        if (r.status === 'started') return head + `<h3 class="us-h">${L.T('What did you find?')}</h3>${x.causes.length ? `<p class="us-sub">${L.T('Pick the cause. Its fix steps open next.')}</p><div class="us-list">${x.causes.map((c) => row('i-cause', { cid: c.id }, `<span class="us-row-t">${L.N(c.name)}</span><span class="us-row-s">${c.fix ? L.T('Fix: {n} steps', { n: c.fix.steps.length }) : L.T('No fix steps written yet')}</span>`, '')).join('')}${row('i-none', {}, `<span class="us-row-t">${L.T('None of these')}</span>`, '')}</div>` : `<p class="us-quiet">${L.T('No causes are listed for this issue yet. Tell the Lead what you found.')}</p><div class="us-foot us-foot-1"><button type="button" class="us-btn us-primary" data-act="i-none">${L.T('Done')}</button></div>`}`;
        if (r.status === 'fixing' && cause && cause.fix) return head + `<p class="us-cause"><span>${L.T('Cause')}</span> ${L.N(cause.name)}</p><h3 class="us-h">${L.T('The fix')} · ${String(cause.fix.name).replace(/^Fix:\s*/i, '').trim() === String(cause.name).trim() ? L.T('{n} steps', { n: cause.fix.steps.length }) : L.N(cause.fix.name)}</h3>` + runner(L, cause.fix, r.run, { finish: L.T('Check it worked') });
        if (r.status === 'verify') return head + `<p class="us-cause"><span>${L.T('Cause')}</span> ${cause ? L.N(cause.name) : ''}</p><h3 class="us-h">${L.T('Check it worked')}</h3><div class="us-box">${x.src === 'limit' ? `${bandBar(x)(x.okVal, 'is-ok')}<dl class="us-kv"><div><dt>${L.T('Now')}</dt><dd class="us-num">${esc(VM.fmtVal(x.okVal, x.unit, x.kindR))}</dd></div><div><dt>${L.T('Limit')}</dt><dd class="us-num">${esc(VM.fmtVal(x.limit, x.unit, x.kindR))}</dd></div></dl><p class="us-okline">${ICON.check} ${L.T('The reading is back inside its limits.')} <span class="us-sample">${L.T('Sample')}</span></p>` : `<p>${L.T('Is the problem gone?')}</p>`}</div><div class="us-foot"><button type="button" class="us-btn" data-act="i-again">${L.T('Pick another cause')}</button><button type="button" class="us-btn us-primary" data-act="i-close">${L.T('Close the issue')}</button></div>`;
        const sum = cause && cause.fix && r.run ? `<dl class="us-kv us-kv-1"><div><dt>${L.T('Cause')}</dt><dd>${L.N(cause.name)}</dd></div><div><dt>${L.T('Steps done')}</dt><dd class="us-num">${cause.fix.steps.length}</dd></div>${Object.keys(r.run.val).length ? `<div><dt>${L.T('Readings you entered')}</dt><dd class="us-num">${Object.keys(r.run.val).map((k) => esc(r.run.val[k])).join(', ')}</dd></div>` : ''}</dl>` : '';
        return head + `<div class="us-done">${ICON.check}<h3>${r.status === 'false' ? L.T('Closed as a false alarm') : r.status === 'lead' ? L.T('The Lead has been told.') : L.T('Issue closed')}</h3></div>${sum}<div class="us-foot us-foot-1"><button type="button" class="us-btn us-primary" data-act="nav" data-to="issues">${L.T('Back to issues')}</button></div>`;
      },
      tasks(L) {
        const td = VM.today; const grp = (state, title) => { const xs = td.filter((t) => t.today.state === state); return xs.length ? `<h2 class="us-h">${title}</h2><div class="us-list">${xs.map((t) => taskRow(L, t)).join('')}</div>` : ''; };
        const cond = VM.conds.slice(0, 3);
        return (td.length ? grp('overdue', L.T('Overdue')) + grp('now', L.T('Due now')) + grp('later', L.T('Later today')) : `<p class="us-quiet">${L.T('Nothing is due today.')}</p>`)
          + (cond.length ? `<h2 class="us-h">${L.T('Raised when a condition holds')}</h2><ul class="us-plain us-conds">${cond.map((c) => `<li><span><span class="us-row-t">${L.N(c.name)}</span><span class="us-row-s">${kindChip(L, 'condition')} ${tag(c.upTag)}</span><span class="us-cond">${L.N(c.sentence)}</span></span><span class="us-watch">${L.T('Watching')}</span></li>`).join('')}</ul>` : '');
      },
      task(L, id) {
        const t = taskOf(id); if (!t) return ''; const R = trun(id); const f = t.flow; const n = f ? arr(f.steps).length : 0;
        const head = `<header class="us-pagehead"><p class="us-ih-c">${kindChip(L, t.wt)} ${critChip(L, t.tier)}</p><h2>${L.N(t.name)}</h2><p>${where(L, t)}</p></header>`;
        if (R.fin) return head + `<div class="us-done">${ICON.check}<h3>${L.T('Task done')}</h3><p>${L.T('How often')}: ${t.basis === 'calendar' ? L.every(t.every, t.everyText) : L.N(cap(t.everyText))}</p></div>${Object.keys(R.val).length ? `<dl class="us-kv us-kv-1"><div><dt>${L.T('Readings you entered')}</dt><dd class="us-num">${Object.keys(R.val).map((k) => esc(R.val[k])).join(', ')}</dd></div></dl>` : ''}<div class="us-foot us-foot-1"><button type="button" class="us-btn us-primary" data-act="nav" data-to="tasks">${L.T('Back to tasks')}</button></div>`;
        if (R.started && f && n) return head + runner(L, f, R, { finish: L.T('Finish the task') });
        const due = t.today ? `<div><dt>${t.today.state === 'overdue' ? L.T('Overdue') : t.today.state === 'now' ? L.T('Due now') : L.T('Later today')}</dt><dd>${t.today.state === 'now' ? `<span class="us-num">${esc(VM.clock)}</span>` : dueText(L, t)}</dd></div>` : '';
        return head + `<dl class="us-kv us-kv-1">${due}<div><dt>${L.T('How often')}</dt><dd>${t.basis === 'calendar' ? L.every(t.every, t.everyText) : L.N(cap(t.everyText))}</dd></div><div><dt>${L.T('Kind of work')}</dt><dd>${L.T(KIND[t.wt] || 'Task')}</dd></div>${t.tier ? `<div><dt>${L.T('Criticality')}</dt><dd>${L.T(TIER[t.tier])}</dd></div>` : ''}</dl>`
          + (f && n ? `<h3 class="us-h">${L.T('Steps')} · ${n}</h3><ol class="us-steps">${f.steps.map((s) => `<li>${L.N(s.text)}${s.type === 'reading' ? ` <span class="us-ty">${L.T('Enter the reading')}</span>` : ''}${s.photo ? ` <span class="us-ty">${L.T(s.photo === 'required' ? 'Take a photo' : 'Photo (optional)')}</span>` : ''}</li>`).join('')}</ol><div class="us-foot us-foot-1"><button type="button" class="us-btn us-primary" data-act="t-start">${R.i > 0 ? L.T('Continue') : L.T('Start')}</button></div>`
            : `<p class="us-quiet">${L.T('No steps are written for this task yet. Do it, then mark it done.')}</p><div class="us-foot us-foot-1"><button type="button" class="us-btn us-primary" data-act="t-fin">${L.T('Mark it done')}</button></div>`);
      },
      report(L) {
        const rp = S().rep || {}; const u = rp.upId ? VM.upOf(rp.upId) : null;
        if (!u) return `<h2 class="us-h">${L.T('Where is the problem?')}</h2><div class="us-list">${VM.ups.map((x) => row('r-up', { id: x.id }, `<span class="us-row-t">${tag(x.tag)} ${L.N(x.typeName)}</span><span class="us-row-s">${L.T('{n} equipment', { n: x.ids.length })}</span>`, '')).join('')}${VM.loose.eq.length ? row('r-up', { id: '@loose' }, `<span class="us-row-t">${L.T('Other equipment')}</span>`, '') : ''}</div>`;
        if (!rp.eqId) { const eqs = (u.self ? [u.self] : []).concat(u.eq); return `<h2 class="us-h">${L.T('Where is the problem?')}</h2><p class="us-sub">${u.id === '@loose' ? L.T('Other equipment') : tag(u.tag) + ' ' + L.N(u.typeName)}</p><div class="us-list">${eqs.map((e) => row('r-eq', { id: e.id }, `<span class="us-row-t">${tag(e.tag)} ${L.N(e.typeName)}</span><span class="us-row-s">${critChip(L, e.tier)}</span>`, '')).join('')}</div>`; }
        const e = VM.eq(rp.eqId); const ps = VM.problemsFor(rp.eqId);
        return `<h2 class="us-h">${L.T('What is the problem?')}</h2><p class="us-sub">${tag(e.tag)} ${L.N(e.typeName)}</p>${ps.length ? `<div class="us-list">${ps.map((p) => row('r-pick', { id: p.id }, `<span class="us-row-t">${L.N(p.name)}</span>`, '')).join('')}</div>` : `<p class="us-quiet">${L.T('No known problems are listed for this equipment yet.')}</p>`}`;
      },
      lang(L) { const cur = lang(); return `<h2 class="us-h">${L.T('Language')}</h2><div class="us-list" role="radiogroup">${LANGS.map((x) => `<button type="button" class="us-row us-lang" role="radio" aria-checked="${x.id === cur}" data-act="setlang" data-id="${x.id}"><span class="us-row-m"><span class="us-row-t">${esc(x.own)}</span><span class="us-row-s">${esc(x.name)}</span></span><span class="us-row-r">${x.id === cur ? ICON.check : ''}</span></button>`).join('')}</div>${cur === 'en' ? '' : `<p class="us-draft">${L.T('This text is a first draft. A native speaker has not read it yet.')}</p>`}`; },
    };
    /* search: what matched, plus one level below it. Each item is listed once. */
    function results(L) {
      const q = String(S().q || '').trim().toLowerCase(); const hl = (t) => { const s = String(t || ''); const k = q.length >= 2 ? s.toLowerCase().indexOf(q) : -1; return k < 0 ? esc(s) : esc(s.slice(0, k)) + `<b class="us-hl">${esc(s.slice(k, k + q.length))}</b>` + esc(s.slice(k + q.length)); };
      const m = (t) => String(t || '').toLowerCase().includes(q); const openK = S().open;
      const eqLine = (e, flat) => row('up', { id: VM.homeOf(e.id) || '@loose' }, `<span class="us-row-k">${L.T('Equipment')}</span><span class="us-row-t"><span class="us-tag">${hl(e.tag)}</span> ${hl(e.typeName)}</span>${flat ? `<span class="us-row-s">${L.T('in {where}', { where: tag((VM.upOf(VM.homeOf(e.id)) || {}).tag || '') || L.T('Other equipment') })}</span>` : ''}`, critChip(L, e.tier));
      const listed = new Set();   /* a piece of equipment that takes part in two unit processes is listed under the first only */
      const upBlock = (u, withEq) => { const k = 'u:' + u.id; const eqs = withEq ? u.eq.filter((e) => !listed.has(e.id)) : []; eqs.forEach((e) => listed.add(e.id)); const show = openK[k] ? eqs : eqs.slice(0, 2);
        return `<div class="us-nest">${row('up', { id: u.id }, `<span class="us-row-k">${L.T('Unit process')}</span><span class="us-row-t"><span class="us-tag">${hl(u.tag)}</span> ${hl(u.typeName)}</span><span class="us-row-s">${L.T('{n} equipment', { n: u.ids.length })}</span>`, critChip(L, u.tier))}${withEq && eqs.length ? `<div class="us-nest-c">${show.map((e) => eqLine(e, false)).join('')}${eqs.length > 2 ? `<button type="button" class="us-more" data-act="more" data-k="${esc(k)}">${openK[k] ? L.T('Show less') : L.T('Show all') + ' · ' + eqs.length}</button>` : ''}</div>` : ''}</div>`; };
      const plantBlock = () => { const k = 'p'; const show = openK[k] ? VM.ups : VM.ups.slice(0, 5); return `<div class="us-nest"><div class="us-row us-row-static"><span class="us-row-m"><span class="us-row-k">${L.T('Plant')}</span><span class="us-row-t">${hl(VM.plant.name)}</span><span class="us-row-s">${L.T('{n} unit processes', { n: VM.ups.length })} · ${L.T('{n} equipment', { n: VM.eqCount })}</span></span></div><div class="us-nest-c">${show.map((u) => upBlock(u, false)).join('')}${VM.ups.length > 5 ? `<button type="button" class="us-more" data-act="more" data-k="p">${openK[k] ? L.T('Show less') : L.T('Show all') + ' · ' + VM.ups.length}</button>` : ''}</div></div>`; };
      if (!q) return plantBlock();
      if (q.length < 2) return `<p class="us-quiet">${L.T('Type at least 2 letters')}</p>`;
      const upHits = VM.ups.filter((u) => m(u.tag) || m(u.name) || m(u.typeName)); const inHit = new Set([].concat(...upHits.map((u) => u.eq.map((e) => e.id))));
      const allEq = [].concat(...VM.ups.map((u) => u.eq)).concat(VM.loose.eq); const seen = new Set();
      const eqHits = allEq.filter((e) => { if (seen.has(e.id) || inHit.has(e.id)) return false; seen.add(e.id); return m(e.tag) || m(e.name) || m(e.typeName); });
      const out = (m(VM.plant.name) ? plantBlock() : '') + upHits.map((u) => upBlock(u, true)).join('') + eqHits.slice(0, 30).map((e) => eqLine(e, true)).join('');
      return out || `<p class="us-quiet">${L.T('Nothing matches “{q}”', { q: esc(S().q.trim()) })}</p>`;
    }

    function draw() {
      const L = speaker(lang()); const r = route(); const name = r[0] === 'home' && S().role === 'lead' ? 'lead' : r[0];
      const body = (SCREEN[name] || SCREEN.home)(L, r[1]);
      const title = { home: esc(VM.plant.name), lead: esc(VM.plant.name), up: L.T('Unit process'), search: L.T('Search'), issues: L.T('Issues'), issue: L.T('Issues'), tasks: L.T('Tasks'), task: L.T('Tasks'), report: L.T('Report a problem'), lang: L.T('Language') }[name] || esc(VM.plant.name);
      const deep = S().stack.length > 1; const tab = S().stack[0][0]; const nI = openIssues().length; const nT = todays().length;
      const nav = (to, icon, label, n) => `<button type="button" class="us-nav-b${tab === to ? ' is-on' : ''}" data-act="nav" data-to="${to}"${tab === to ? ' aria-current="page"' : ''}>${icon}${n ? `<span class="us-nav-n">${n}</span>` : ''}<span>${label}</span></button>`;
      el.innerHTML = `<div class="us-bar">${deep ? `<button type="button" class="us-ib" data-act="back" aria-label="${L.T('Back')}">${ICON.back}</button>` : '<span class="us-ib us-ib-0"></span>'}<span class="us-bar-t">${title}${name === 'home' || name === 'lead' ? ` <span class="us-role">${L.T(S().role === 'lead' ? 'Lead' : 'Operator')}</span>` : ''}</span><button type="button" class="us-ib" data-act="go" data-to="search" aria-label="${L.T('Search')}">${ICON.search}</button><button type="button" class="us-ib us-lb" data-act="go" data-to="lang" aria-label="${L.T('Language')}">${esc(SHORT[lang()] || 'EN')}</button></div>`
        + `<div class="us-scr" lang="${esc(lang())}">${body}${L.miss ? `<p class="us-miss"><span class="us-en">Aa</span> ${L.T('Not translated yet: shown in English')}</p>` : ''}</div>`
        + `<nav class="us-nav">${nav('home', ICON.home, L.T('Overview'), 0)}${nav('issues', ICON.issue, L.T('Issues'), nI)}${nav('tasks', ICON.task, L.T('Tasks'), nT)}${nav('report', ICON.report, L.T('Report'), 0)}</nav>`;
      if (I.opts.onDraw) I.opts.onDraw(I);
    }
    const top = () => { const s = el.querySelector('.us-scr'); if (s) s.scrollTop = 0; };
    const go = (r) => { S().stack.push(r); draw(); top(); };
    const curRun = () => { const r = route(); if (r[0] === 'task') { const t = taskOf(r[1]); return t && t.flow ? { R: trun(r[1]), flow: t.flow, kind: 'task' } : null; } if (r[0] === 'issue') { const x = issueOf(r[1]); const q = ir(r[1]); const c = x && q.causeId ? x.causes.find((k) => k.id === q.causeId) : null; return q.status === 'fixing' && c && c.fix ? { R: q.run, flow: c.fix, kind: 'fix', q } : null; } return null; };
    const curStep = (cr) => arr(cr.flow.steps)[Math.max(0, Math.min(cr.R.i || 0, cr.flow.steps.length - 1))];
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]'); if (!b || !el.contains(b) || b.disabled) return; const act = b.getAttribute('data-act'); const id = b.getAttribute('data-id'); const r = route(); const cr = curRun();
      if (act === 'nav') { const to = b.getAttribute('data-to'); S().stack = [[to]]; if (to === 'report') S().rep = {}; draw(); top(); return; }
      if (act === 'go') { const to = b.getAttribute('data-to'); if (r[0] === to) return; go([to]); return; }
      if (act === 'back') { if (r[0] === 'report' && S().rep && S().rep.eqId) { S().rep.eqId = null; draw(); return; } if (r[0] === 'report' && S().rep && S().rep.upId) { S().rep = {}; draw(); return; } if (S().stack.length > 1) S().stack.pop(); draw(); top(); return; }
      if (act === 'up' || act === 'issue' || act === 'task') { go([act, id]); return; }
      if (act === 'more') { const k = b.getAttribute('data-k'); S().open[k] = !S().open[k]; const res = el.querySelector('.us-res'); if (res) res.innerHTML = results(speaker(lang())); else draw(); return; }
      if (act === 'setlang') { if (S().lang || I.opts.fixedLang) S().lang = id; else safe(() => W.V7LANG.set(id), null); if (I.opts.onLang) I.opts.onLang(id); draw(); return; }
      if (act === 'remind') { S().reminded[id] = true; draw(); return; }
      if (act === 't-start') { const R = trun(r[1]); R.started = true; draw(); top(); return; }
      if (act === 't-fin') { trun(r[1]).fin = true; draw(); top(); return; }
      if (act === 'i-start') { ir(r[1]).status = 'started'; draw(); top(); return; }
      if (act === 'i-false') { ir(r[1]).status = 'false'; draw(); top(); return; }
      if (act === 'i-none') { ir(r[1]).status = 'lead'; draw(); top(); return; }
      if (act === 'i-cause') { const q = ir(r[1]); const x = issueOf(r[1]); const c = x.causes.find((k) => k.id === b.getAttribute('data-cid')); q.causeId = c.id; if (c.fix && c.fix.steps.length) { q.status = 'fixing'; q.run = newRun(); q.run.started = true; } else q.status = 'verify'; draw(); top(); return; }
      if (act === 'i-again') { const q = ir(r[1]); q.status = 'started'; q.causeId = null; q.run = null; draw(); top(); return; }
      if (act === 'i-close') { ir(r[1]).status = 'closed'; draw(); top(); return; }
      if (act === 'r-up') { S().rep = { upId: id }; draw(); top(); return; }
      if (act === 'r-eq') { S().rep.eqId = id; draw(); top(); return; }
      if (act === 'r-pick') { const pr = VM.problemsFor(S().rep.eqId).find((p) => p.id === id); if (!pr) return; const x = VM.reportIssue(S().rep.eqId, pr, S().added.length + 1); S().added.push(x); S().rep = {}; S().stack = [['issues'], ['issue', x.id]]; draw(); top(); return; }
      if (!cr) return; const s = curStep(cr); const R = cr.R;
      if (act === 'ans') { R.ans[s.id] = b.getAttribute('data-a'); draw(); return; }
      if (act === 'wait') { R.wait[s.id] = !R.wait[s.id]; draw(); return; }
      if (act === 'photo') { R.photo[s.id] = !R.photo[s.id]; draw(); return; }
      if (act === 'link') { R.link[s.id] = !R.link[s.id]; draw(); return; }
      if (act === 'prev') { R.i = Math.max(0, (R.i || 0) - 1); draw(); top(); return; }
      if (act === 'next') { if (!stepOk(s, R)) return; R.done[s.id] = true; if ((R.i || 0) < cr.flow.steps.length - 1) { R.i = (R.i || 0) + 1; draw(); top(); return; } if (cr.kind === 'task') R.fin = true; else cr.q.status = 'verify'; draw(); top(); }
    });
    el.addEventListener('input', (ev) => {
      const t = ev.target; const k = t.getAttribute && t.getAttribute('data-in'); if (!k) return;
      if (k === 'q') { S().q = t.value; const res = el.querySelector('.us-res'); if (res) res.innerHTML = results(speaker(lang())); return; }
      const cr = curRun(); if (!cr) return; const s = curStep(cr); cr.R.val[s.id] = t.value; const ok = stepOk(s, cr.R); const nx = el.querySelector('[data-act="next"]'); if (nx) nx.disabled = !ok; const why = el.querySelector('[data-why]'); if (why) { why.hidden = ok; why.innerHTML = stepWhy(speaker(lang()), s, cr.R); }
    });
    el.addEventListener('toggle', (ev) => { const d = ev.target; const k = d && d.getAttribute && d.getAttribute('data-keep'); if (k) S().open[k] = d.open; }, true);
    I.draw = draw; I.set = (s) => { I.S = s; draw(); top(); }; I.route = route; I.lang = lang;
    draw(); return I;
  }

  /* ── states a reviewer can jump to ────────────────────────────────────────────────────────────────────── */
  const state = (o) => Object.assign({ role: 'op', stack: [['home']], q: '', tr: {}, ir: {}, added: [], rep: {}, open: {}, reminded: {}, lang: null }, o || {});
  function runTo(flow, k) { const R = newRun(); R.started = true; R.i = k; arr(flow.steps).slice(0, k).forEach((s) => { R.done[s.id] = true; if (s.type === 'reading') R.val[s.id] = '0.4'; if (s.photo) R.photo[s.id] = true; if (s.type === 'question') R.ans[s.id] = 'Yes'; if (s.type === 'wait') R.wait[s.id] = true; }); return R; }
  function presets(VM) {
    const P = {}; const t = VM.demoTask; const f = t && t.flow; const idx = (fl, fn, d) => { const k = arr(fl && fl.steps).findIndex(fn); return k < 0 ? d : k; };
    const i1 = VM.issues.find((x) => x.id === 'i1') || VM.issues[0] || null; const i3 = VM.issues.find((x) => x.id === 'i3') || null;
    const richest = (x) => (x ? x.causes.filter((c) => c.fix).sort((a, b) => { const sc = (c) => arr(c.fix.steps).reduce((n, s) => n + (s.type === 'reading' ? 3 : 0) + (s.photo ? 2 : 0) + (s.type === 'question' ? 1 : 0), 0); return sc(b) - sc(a); })[0] || null : null);
    const c1 = richest(i1); const c3 = i3 ? i3.causes.find((c) => c.fix && arr(c.fix.steps).some((s) => s.link)) : null;
    P.today = () => state();
    P.up = () => state({ stack: [['home'], ['up', (t && t.upId) || (VM.ups[0] || {}).id]] });
    P.search = () => state({ stack: [['home'], ['search']], q: ((VM.ups.find((u) => u.eq.length) || VM.ups[0] || {}).tag || 'tank').slice(0, 3).toLowerCase() });
    P.tasks = () => state({ stack: [['tasks']] });
    if (t) {
      P.taskStart = () => state({ stack: [['tasks'], ['task', t.id]] });
      if (f) {
        const run = (k) => { const s = state({ stack: [['tasks'], ['task', t.id]] }); s.tr[t.id] = runTo(f, k); return s; };
        P.taskStep = () => run(0);
        P.taskReading = () => run(idx(f, (s) => s.type === 'reading', 0));
        P.taskPhoto = () => run(idx(f, (s) => !!s.photo, f.steps.length - 1));
        P.taskWait = () => run(idx(f, (s) => s.type === 'wait' || s.type === 'question', 0));
        P.taskDone = () => { const s = run(f.steps.length - 1); s.tr[t.id].fin = true; s.tr[t.id].i = f.steps.length - 1; arr(f.steps).forEach((q) => { if (q.type === 'reading') s.tr[t.id].val[q.id] = '0.4'; }); return s; };
      }
    }
    P.issues = () => state({ stack: [['issues']] });
    if (i1) {
      const at = (status, extra) => { const s = state({ stack: [['issues'], ['issue', i1.id]] }); s.ir[i1.id] = Object.assign({ status, causeId: null, run: null }, extra || {}); return s; };
      P.issueOpen = () => at('open'); P.issueCauses = () => at('started');
      if (c1) { P.fixStep = () => at('fixing', { causeId: c1.id, run: runTo(c1.fix, 0) }); P.fixReading = () => at('fixing', { causeId: c1.id, run: runTo(c1.fix, idx(c1.fix, (s) => s.type === 'reading', idx(c1.fix, (s, k) => k > 0 && (!!s.photo || s.type === 'question'), Math.min(1, c1.fix.steps.length - 1)))) }); P.verify = () => at('verify', { causeId: c1.id, run: runTo(c1.fix, c1.fix.steps.length - 1) }); P.closed = () => at('closed', { causeId: c1.id, run: runTo(c1.fix, c1.fix.steps.length - 1) }); }
    }
    if (i3 && c3) P.fixLink = () => { const s = state({ stack: [['issues'], ['issue', i3.id]] }); const k = idx(c3.fix, (q) => !!q.link, 0); const R = runTo(c3.fix, k); R.link[c3.fix.steps[k].id] = true; s.ir[i3.id] = { status: 'fixing', causeId: c3.id, run: R }; return s; };
    P.report = () => state({ stack: [['report']] });
    P.lead = () => state({ role: 'lead' });
    P.lang = () => state({ stack: [['home'], ['lang']] });
    return P;
  }

  W.USER = { vm: null, build, mount: (el, s, opts) => App(el, s, opts), presets, state, LANGS, globalLang, KEY };
})();
