/* v7 · object7.js · window.V7OBJ — the one object page: an equipment at a plant and a library type, laid out the same way;
   its phone view; the limits sheet (the only editor of limits, with a live "Last 7 days" replay); the alert page.
   Loads after core7.js (window.V7) and ui7.js (window.V7UI).

   ONE PAGE, TWO SUBJECTS
     render({mode:'instance', plant, eqId, tab, aside}) → html   equipment at a plant; edits become this plant's changes (overrides)
     render({mode:'type', code, tab, aside})            → html   a library type; edits go to the draft (V7.editLib); `aside` is
                                                                  where lib7 puts Where it lands + Publish
     Tabs: Readings · Issues · Tasks · Details  (ids readings | issues | tasks | details; anything else → readings)
   ROUTES
     p/:plant/eq/:id/:tab?    the equipment page
     p/:plant/eq/:id/phone    the Phone view (the Equipment Card in a phone frame); ?r=<sensorId> shows one reading
     p/:plant/alert/:id       the alert page
     Deep link: #/p/<plant>/eq/<id>?limits=<sensorId>[&dir=above|below] opens the limits sheet when the page arrives.
   SHEETS (DOM; each opens from a button with data-act, or call them directly)
     openLimits({plant, sensorId, dir} | {mode:'type', code, reading, dir})   bands, source chips, live replay, reason + redirects
     openTiming({plant, alertId} | {mode:'type', code, alert})                must hold for / must clear for
     openCadence({plant, taskId} | {mode:'type', code, schedule})             how often a task comes round
     openTier(plant, eqId)                                                    criticality
     report(plant, eqId)   "Report a problem": hands over to work7 (V7WORK.openReport(plant, eqId), or V7WORK.report / reportProblem)
                           when present; otherwise a small picker here that calls V7.report and opens the new issue.
   ACTIONS (V7UI.on): obj:limits obj:ldir obj:lback obj:lsave obj:redirect obj:timing obj:tsave obj:cadence obj:csave obj:tier
     obj:tiersave obj:vback obj:astate obj:aoff obj:report obj:rsave obj:scada obj:suggest obj:sgsave
   Words on screen follow the plain-words rule: equipment, reading, limits, alert, issue, task, the database's type names verbatim, and
   the six source chips. Sample plants' numbers carry the "Sample readings" tag.                                               */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const UI = W.V7UI;
  if (!UI) { W.V7OBJ = { render: () => '' }; return; }
  const V = () => W.V7 || null;
  const { esc, chip, sourceChip, stateChip, sampleTag, sev, bandName, bandBar, card, section, kv, list, empty, note, banner, stats, btn, plural, isNum } = UI;

  const BANDS = ['caution', 'minor', 'major', 'emergency'];
  const RANK = { caution: 1, minor: 2, major: 3, emergency: 4 };
  const MIN = 60000; const HOUR = 60 * MIN; const DAY = 24 * HOUR;
  const TABS = [['readings', 'Readings'], ['issues', 'Issues'], ['tasks', 'Tasks'], ['details', 'Details']];
  const UNITS = ['hour', 'day', 'week', 'month', 'year'];
  const TIER = { A: 'Critical', B: 'Essential', C: 'Standard' };

  /* ── helpers ──────────────────────────────────────────────────────────────────────────────────────────── */
  const SOFT = Array.isArray(UI._soft) ? UI._soft : [];
  function safe(fn, fb) {
    try { const v = fn(); return v === undefined || v === null ? fb : v; }
    catch (e) { SOFT.push('object7: ' + String(e && e.message || e)); if (SOFT.length > 200) SOFT.shift(); return fb; }
  }
  const arr = (x) => (Array.isArray(x) ? x : []);
  const H = (s) => ({ html: String(s == null ? '' : s) });
  const enc = encodeURIComponent;
  const num = (x) => (x === null || x === undefined || x === '' ? null : (isFinite(+x) ? +x : null));
  const same = (a, b) => { const x = num(a); const y = num(b); return (x == null && y == null) || (x != null && y != null && Math.abs(x - y) < 1e-9); };
  const sameEvery = (a, b) => (!a && !b) || (!!a && !!b && +a.n === +b.n && a.unit === b.unit);
  const cap = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  const now = () => safe(() => V().now(), Date.UTC(2026, 9, 29, 3, 30));
  const fmt = (ms) => UI.fmt(ms);
  const fmtDay = (ms) => UI.fmtDay(ms);
  const isoDay = (ms) => new Date(+ms + 330 * MIN).toISOString().slice(0, 10);
  function fv(v, unit, kind) {
    if (num(v) == null) return '—';
    const r = safe(() => V().fmtVal(+v, unit || '', kind), null);
    return r != null ? r : UI.num(v, unit);
  }
  function fdur(min) { return min == null ? 'still going' : safe(() => V().fmtDur(min), `${Math.round(min)} min`); }
  function n1(x) { const v = +x || 0; return v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10); }
  /* v7: rates a day use the one shared formatter (V7UI.rate), so this page and Coverage show the same number */
  const rt = (x) => (UI.rate ? UI.rate(x) : n1(x));
  const times = (n) => plural(n, 'time');
  const dirWord = (dir) => (dir === 'below' ? 'below' : 'above');
  const dirHead = (dir) => (dir === 'below' ? 'Falls below' : 'Rises above');
  const everyText = (ev) => (ev && ev.n ? safe(() => V().everyText(ev), `every ${ev.n} ${ev.unit}`) : 'no set interval');
  const sevClock = (b) => cap(String(safe(() => V().sevClock(b), '')).replace(/^Caution:\s*/, ''));
  const LBL = (grp, k) => safe(() => V().LABELS[grp][k], null) || cap(k);

  const plantHref = (k, sub) => `#/p/${enc(k)}${sub ? '/' + sub : ''}`;
  const eqHref = (k, id, tab) => `#/p/${enc(k)}/eq/${enc(id)}${tab && tab !== 'readings' ? '/' + tab : ''}`;
  const phoneHref = (k, id, r) => `#/p/${enc(k)}/eq/${enc(id)}/phone${r ? '?r=' + enc(r) : ''}`;
  const alertHref = (k, id) => `#/p/${enc(k)}/alert/${enc(id)}`;
  const issueHref = (k, id) => `#/p/${enc(k)}/issue/${enc(id)}`;
  const taskHref = (k, id) => `#/p/${enc(k)}/task/${enc(id)}`;
  const libHref = (code, tab) => `#/library/${enc(code)}${tab && tab !== 'readings' ? '/' + tab : ''}`;
  const a = (href, label) => `<a href="${esc(href)}">${esc(label)}</a>`;

  function plantOf(key) { return safe(() => V().plant(key), null) || arr(safe(() => V().plants(), [])).find((p) => p.key === key) || null; }
  function eqOf(key, id) { return safe(() => V().eq(key, id), null); }
  function tagOf(key, id) { const e = eqOf(key, id); return e ? e.tag : 'other equipment'; }
  function codeOf(e) { return e ? (e.dbType || e.code) : null; }
  function libTypeOf(e) { const c = codeOf(e); return c ? safe(() => V().libType(c), null) : null; }
  function readingOf(key, id) {
    return arr(safe(() => V().readings(key, {}), [])).find((x) => x.id === id) || arr(safe(() => V().sensors(key), [])).find((x) => x.id === id) || null;
  }
  function validFor(s) {
    const v = s && s.valid;
    return Array.isArray(v) && isFinite(v[0]) && isFinite(v[1]) && v[1] > v[0] && v[1] - v[0] < 1e7 ? v : null;
  }
  function bandNow(v, dir, bands, kind) {
    if (num(v) == null || !bands) return null;
    let hit = null;
    BANDS.forEach((b) => {
      const t = num(bands[b]); if (t == null) return;
      const past = kind === 'status' ? (dir === 'below' ? v <= t : v >= t) : (dir === 'below' ? v < t : v > t);
      if (past) hit = b;
    });
    return hit;
  }
  const toneOfBand = (b) => (!b ? '' : RANK[b] >= 3 ? 'bad' : 'warn');
  function limText(b, v, dir, s) {
    if (s && s.kind === 'status') return `when ${fv(v, '', 'status')}`;
    return `${dirWord(dir)} ${fv(v, s && s.unit, s && s.kind)}`;
  }
  function chipNamed(kind, text) {
    const map = { lib: ['Follows the library', 'lib'], form: ['From the plant graph', 'form'], changed: ['Plant’s own value', 'changed'], libchanged: ['Library changed since', 'libchanged'], none: ['No limits yet', 'none'], next: ['Next phase', 'next'] };
    const m = map[kind] || map.lib;
    return chip(text || m[0], { tone: m[1] });
  }
  const draftChip = () => chip('In the draft', { tone: 'info', title: 'Changed in the library draft. Plants keep the published value until it is published.' });
  function foundByText(kinds) {
    const W2 = { sensor: 'a sensor', visual: 'a look on the round', manual: 'a manual or lab test' };
    const ks = arr(kinds).map((k) => W2[k] || k);
    return ks.length ? 'Found by ' + ks.join(' or ') : 'How it is found is not recorded';
  }
  function plantStateLine(P) {
    if (!P) return '';
    if (P.state === 'live') return `Live since ${fmtDay(P.since)}`;
    const day = Math.floor((now() - P.since) / DAY) + 1;
    return `Commissioning since ${fmt(P.since)}${day >= 2 ? ` · day ${day} of trial` : ''}`;
  }

  /* ── limits, shown the same way for an equipment and for a type ──────────────────────────────────────── */
  /* rows to show for one direction: bands with a value, and bands this plant (or the draft) removed */
  function bandRows(lim, mode) {
    const pbs = (lim && lim.perBand) || {}; const out = [];
    BANDS.forEach((b) => {
      const p = pbs[b] || { value: lim && lim.bands ? lim.bands[b] : null };
      const v = num(p.value);
      const removed = v == null && (mode === 'type'
        ? p.draftValue !== undefined && num(p.libValue) != null
        : (p.chip === 'changed' || p.chip === 'libchanged') && (num(p.baseValue) != null || num(p.libValue) != null || num(p.base) != null));
      if (v == null && !removed) return;
      out.push({ b, v, p, removed });
    });
    return out;
  }
  function chipOf(p, mode) { if (mode === 'type') return p.draftValue !== undefined ? draftChip() : chipNamed('lib'); return sourceChip(p); }
  function chipKey(p, mode) { return mode === 'type' ? (p.draftValue !== undefined ? 'draft' : 'lib') : String(p.chipText || p.chip || ''); }
  function wasText(r, mode, s) {
    const p = r.p;
    if (mode === 'type') return p.draftValue !== undefined ? `<span class="o-was">was ${esc(num(p.libValue) == null ? 'none' : fv(p.libValue, s.unit, s.kind))}</span>` : '';
    if (p.chip === 'changed' || p.chip === 'libchanged') {
      const base = num(p.baseValue != null ? p.baseValue : p.base);                 // what the value would be without the change
      const fromForm = num(p.formValue) != null && same(base, p.formValue) && !same(base, p.libValue);
      const label = fromForm ? 'plant graph' : p.chip === 'libchanged' ? 'library now' : 'library';
      /* v7: the library moved to this plant's own value (a publish): say it plainly, not only "Library changed since" */
      if (base != null && r.v != null && same(base, r.v)) return `<span class="o-was">now the same as the ${fromForm ? 'plant graph' : 'library'}</span>`;
      if (base != null && !same(base, r.v)) return `<span class="o-was">${label} ${esc(fv(base, s.unit, s.kind))}</span>`;
      if (base == null && num(p.libValue) != null && !same(p.libValue, r.v)) return `<span class="o-was">library ${esc(fv(p.libValue, s.unit, s.kind))}</span>`;
    }
    return '';
  }
  function limitsLine(lim, s, mode) {
    const rows = bandRows(lim, mode);
    if (!rows.length) return `<ul class="o-lims"><li class="o-lim">${chipNamed('none')}</li></ul>`;
    const one = new Set(rows.map((r) => chipKey(r.p, mode))).size === 1;
    const items = rows.map((r) => {
      const val = r.removed ? `<span class="muted">none</span>` : `<b>${esc(limText(r.b, r.v, lim.dir, s))}</b>`;
      return `<li class="o-lim">${sev(r.b)} ${val}${wasText(r, mode, s)}${one ? '' : ' ' + chipOf(r.p, mode)}</li>`;
    }).join('');
    return `<ul class="o-lims">${items}${one ? `<li class="o-lim">${chipOf(rows[0].p, mode)}</li>` : ''}</ul>`;
  }
  /* v7: what a line raises at the plant (condition-based work), under the reading's limits */
  function lineWorkHtml(key, sensorId, dir) {
    const ws = arr(safe(() => V().lineWork(key, { sensorId, dir }), [])); if (!ws.length) return '';
    return `<ul class="lw-list">${ws.map((w) => { const t = safe(() => V().task(key, w.id), null); return `<li>${sev(w.band)} <span class="lw-does">raises</span> ${a(taskHref(key, w.id), w.name)} <span class="lw-does">at the plant${t ? ' · ' + esc(t.statusLabel) : ''}, instead of an issue</span></li>`; }).join('')}</ul>`;
  }
  function hasLimits(lim) { return !!lim && BANDS.some((b) => num(lim.bands && lim.bands[b]) != null); }

  /* where a type's reading sits at the plants: every sensor of that name on equipment of that type */
  function typeSites(typeName, reading) {
    const out = [];
    arr(safe(() => V().plants(), [])).forEach((p) => {
      arr(safe(() => V().equipment(p.key), [])).filter((e) => e.typeName === typeName).forEach((e) => {
        arr(safe(() => V().sensors(p.key, e.id), [])).filter((s) => s.name === reading && !s.nextPhase).forEach((s) => out.push({ key: p.key, plant: p.name, e, s }));
      });
    });
    return out;
  }
  function followsLib(p) { return !p || p.chip === 'lib' || p.chip === 'none'; }
  function atPlantsLine(typeName, reading, dir) {
    const sites = typeSites(typeName, reading);
    if (!sites.length) return 'No plant has this reading yet.';
    let follow = 0; let form = 0; const changed = new Map();
    sites.forEach((x) => {
      const lim = safe(() => V().limitsOf(x.key, x.s.id, dir), null); if (!lim) return;
      const pbs = BANDS.map((b) => (lim.perBand || {})[b]);
      if (pbs.some((p) => p && (p.chip === 'changed' || p.chip === 'libchanged'))) changed.set(x.plant, (changed.get(x.plant) || 0) + 1);
      else if (pbs.some((p) => p && p.chip === 'form')) form++;
      else follow++;
    });
    const bits = [`${plural(follow, 'reading')} ${follow === 1 ? 'follows' : 'follow'} the library`];
    if (form) bits.push(`${form} set by the plant graph`);
    /* v7: a library page has no "here": count the changed readings per plant ("1 changed at Manesar STP") */
    changed.forEach((n, plant) => bits.push(`${n} changed at ${plant}`));
    return `At the plants: ${bits.join(' · ')}.`;
  }

  /* ── reading cards ────────────────────────────────────────────────────────────────────────────────────── */
  /* v7: a reading with limits both ways ("Rises above" and "Falls below") gets one Change limits per direction, under its heading,
     so the sheet opens on the direction you meant (MLSS low on Diffuser Tank opens on "Falls below") */
  function readingCard(m) {
    const perDir = arr(m.dirs).length > 1 && arr(m.dirs).every((d) => d.act);
    const dirs = arr(m.dirs).map((d) => `<div class="o-dir">${m.dirs.length > 1 ? `<div class="o-dir-k">${esc(dirHead(d.dir))}${perDir ? ` ${d.act}` : ''}</div>` : ''}${d.bar ? `<div class="o-dir-bar">${d.bar}</div>` : ''}${d.line || ''}${d.after || ''}</div>`).join('');
    const al = arr(m.alerts).filter(Boolean); const action = perDir ? '' : m.action;
    return `<article class="o-rd${m.tone ? ' tone-' + m.tone : ''}"${m.id ? ` id="${esc(m.id)}"` : ''}>`
      + `<header class="o-rd-h"><div class="o-rd-hl"><h3 class="o-rd-t">${esc(m.name)}${m.tag ? `<span class="mono">${esc(m.tag)}</span>` : ''}</h3>${m.sub ? `<p class="o-rd-s">${m.sub}</p>` : ''}</div>${action ? `<div class="o-rd-a">${action}</div>` : ''}</header>`
      + dirs + (m.extra || '') + (al.length ? `<div class="o-al">${al.join('')}</div>` : '') + '</article>';
  }
  function covRow(key, alertId) { const c = safe(() => V().coverage(key), null); return c ? arr(c.alerts).find((r) => r.alertId === alertId) || null : null; }
  function alertRate(key, al) {
    if (al.state === 'trial') {
      const ts = safe(() => V().trialStats(key, al.id), null);
      if (!ts) return { text: 'On trial: no firings yet', chips: [] };
      const chips = [];
      if (ts.noisy) chips.push(chip('Noisy', { tone: 'warn', title: 'More than 10 trial firings a day' }));
      else if (ts.mostlyShort) chips.push(chip('Mostly short', { tone: 'muted', title: 'Most firings lasted 30 min or less and peaked within 10% of the limit' }));
      return { text: `${rt(ts.perDay)} trial ${rt(ts.perDay) === '1' ? 'firing' : 'firings'} a day${al.trialUntil ? ` · on trial until ${fmtDay(al.trialUntil)}` : ''}`, chips };
    }
    if (al.state === 'on') {
      const r = covRow(key, al.id); const chips = [];
      if (al.openIssueId) chips.push(chip('Open issue', { tone: 'bad', href: issueHref(key, al.openIssueId) }));
      return { text: r ? `${rt(r.firesPerDay)} ${rt(r.firesPerDay) === '1' ? 'issue' : 'issues'} a day` : 'No issues lately', chips };
    }
    if (al.state === 'draft') return { text: 'Draft: proposed, not decided yet', chips: [] };
    return { text: 'Reads nothing while Off', chips: [] };
  }
  function alertLine(key, al) {
    const r = alertRate(key, al);
    return `<div class="o-al-r">${a(alertHref(key, al.id), al.name)} ${stateChip(al.state)} <span class="muted">${esc(r.text)}</span>${r.chips.join(' ')}</div>`;
  }
  function pendingProposals(key, eqId) {
    const P = plantOf(key); if (!P || P.state !== 'commissioning') return [];
    const row = arr(safe(() => V().libraryReview(key), [])).find((r) => r.eqId === eqId);
    return row ? arr(row.proposals) : [];
  }

  function instReadingModel(key, P, e, s, props) {
    const v = s.latest ? num(s.latest.v) : null;
    const isStatus = s.kind === 'status'; const isMeter = s.kind === 'meter' || (!s.takesLimits && s.kind !== 'manual');
    const dirs = arr(s.dirs);
    const lims = dirs.map((dir) => ({ dir, lim: safe(() => V().limitsOf(key, s.id, dir), null) })).filter((x) => x.lim);
    let where = null;
    lims.forEach((x) => { const b = bandNow(v, x.dir, x.lim.bands, s.kind); if (b && (!where || RANK[b] > RANK[where])) where = b; });
    const alerts = arr(safe(() => V().alerts(key, { sensorId: s.id }), []));
    const noisy = alerts.some((al) => al.state === 'trial' && safe(() => V().isNoisy(key, al.id), false));
    const anyLimits = lims.some((x) => hasLimits(x.lim) || bandRows(x.lim, 'instance').length);
    let sub = '';
    if (s.kind === 'manual') sub = `${s.source === 'lab' ? 'Lab test' : 'Entered by hand'} · expected ${esc(s.expected || 'on its schedule')}. No samples.`;
    else if (v == null) sub = 'No reading yet';
    else {
      sub = `Now <b>${esc(fv(v, s.unit, s.kind))}</b>`;
      if (!isMeter && anyLimits) sub += where ? ` · <span class="tx-${toneOfBand(where)}">in ${esc(bandName(where))}</span>` : ' · inside the limits';
    }
    const dirsOut = lims.map((x) => ({
      dir: x.dir,
      bar: isStatus || s.kind === 'manual' || !hasLimits(x.lim) ? '' : bandBar({ dir: x.dir, bands: x.lim.bands, value: v, valid: validFor(s), unit: s.unit }),
      line: limitsLine(x.lim, s, 'instance') + lineWorkHtml(key, s.id, x.dir),
    }));
    let extra = '';
    if (isMeter) extra = `<p class="o-hint">${s.kind === 'meter' ? 'Counts up. Run-hours tasks use it; it has no limits.' : 'Worked out from other readings; it has no limits here.'}</p>`;
    else if (isStatus && !lims.length) extra = '<p class="o-hint">Reads ON or OFF and shows whether the equipment is running. It has no limits.</p>';
    const alertRows = alerts.map((al) => alertLine(key, al));
    arr(props).filter((p) => p.kind === 'alert' && !p.decided && (p.sensorId === s.id || p.reading === s.name) && !alerts.some((al) => al.name.split(' — ')[0] === p.name))
      .forEach((p) => alertRows.push(`<div class="o-al-r"><span>${esc(p.name)}</span> ${stateChip('draft')} <span class="muted">Proposed by the library, not decided yet</span> ${a(plantHref(key, 'library'), 'Decide in What the library brings')}</div>`));
    const editable = s.kind === 'manual' || (s.takesLimits && !isMeter && !(isStatus && !lims.length));
    const dir0 = s.primaryDir || dirs[0] || null;
    if (editable) dirsOut.forEach((d) => { const L = lims.find((x) => x.dir === d.dir); d.act = btn(L && hasLimits(L.lim) ? 'Change limits' : 'Set limits', { act: 'obj:limits', data: { plant: key, sensor: s.id, dir: d.dir }, small: true, kind: 'ghost', title: `Change the limits for ${s.name} ${dirWord(d.dir)}` }); });
    return {
      id: 'r-' + s.id, name: s.name, tag: s.tag, sub, dirs: dirsOut, extra, alerts: alertRows,
      tone: where ? toneOfBand(where) : noisy ? 'warn' : '', rank: where ? RANK[where] * 10 : noisy ? 5 : 0,
      action: editable ? btn(anyLimits ? 'Change limits' : 'Set limits', { act: 'obj:limits', data: { plant: key, sensor: s.id, dir: dir0 }, small: true, kind: anyLimits ? 'secondary' : 'primary' }) : '',
    };
  }
  function typeReadingModel(lt, r) {
    const dr = lt.draft || null;
    const s = { unit: r.unit, kind: r.kind, name: r.name };
    const dirs = arr(r.dirs).map((d) => {
      const lim = { dir: d.dir, bands: d.bands, perBand: d.perBand };
      const alerts = arr(lt.alerts).filter((x) => x.reading === r.name && x.dir === d.dir);
      const al = alerts.map((x) => {
        const dt = dr && dr.alerts ? dr.alerts[x.name] || {} : {};
        const hold = dt.hold != null ? dt.hold : x.hold; const clear = dt.clear != null ? dt.clear : x.clear;
        const flow = x.flowId ? safe(() => V().flowOf(x.flowId), null) : null;
        const inDraft = dt.hold != null || dt.clear != null;
        return `<div class="o-al-r"><b>${esc(x.name)}</b> <span class="muted">must hold for ${esc(hold)} min · must clear for ${esc(clear)} min${flow ? ` · starts ${esc(flow.name)}` : ''}</span>${inDraft ? ' ' + draftChip() : ''} ${btn('Change times', { act: 'obj:timing', data: { mode: 'type', code: lt.code, alert: x.name }, small: true, kind: 'ghost' })}</div>`;
      });
      return {
        dir: d.dir, bands: d.bands,
        bar: r.kind === 'status' || !hasLimits(lim) ? '' : bandBar({ dir: d.dir, bands: d.bands, valid: validFor(r), unit: r.unit }),
        line: limitsLine(lim, s, 'type'),
        after: `<p class="o-hint">${esc(atPlantsLine(lt.typeName, r.name, d.dir))}</p>`,
        al,
      };
    });
    const anyLimits = dirs.some((d) => hasLimits({ bands: arr(r.dirs).find((x) => x.dir === d.dir).bands }));
    const status = r.kind === 'status';
    const noRules = status && !anyLimits && !arr(lt.alerts).some((x) => x.reading === r.name);
    const counter = r.kind === 'meter';   /* v7: a counter has no limits here either */
    const unitBit = r.unit ? ` · in ${esc(r.unit)}` : '';
    /* v7: range ends written like the limits and gauge ticks ("0 mg/L to 12,000 mg/L"); a counter has no range to give */
    const fend = (x) => (UI.numEnd ? UI.numEnd(x, r.unit) : fv(x, r.unit, r.kind));
    const range = validFor(r) && !status && !counter ? ` · reads ${esc(fend(r.valid[0]))} to ${esc(fend(r.valid[1]))}` : '';
    return {
      id: 'r-' + r.name, name: r.name, tag: r.tag, sub: `${status ? 'ON or OFF' : cap(r.kind || 'reading')}${unitBit}${range}`,
      dirs: noRules || counter ? [] : dirs.map((d) => ({ dir: d.dir, bar: d.bar, line: d.line, after: d.after, act: btn(hasLimits({ bands: d.bands }) ? 'Change limits' : 'Set limits', { act: 'obj:limits', data: { mode: 'type', code: lt.code, reading: r.name, dir: d.dir }, small: true, kind: 'ghost', title: `Change the limits for ${r.name} ${dirWord(d.dir)}` }) })),
      extra: counter ? '<p class="o-hint">Counts up. Run-hours tasks use it; it has no limits.</p>' : noRules ? '<p class="o-hint">Reads ON or OFF and shows whether the equipment is running. It has no limits.</p>' : '',
      alerts: [].concat(...dirs.map((d) => d.al)),
      action: noRules || counter ? '' : btn(anyLimits ? 'Change limits' : 'Set limits', { act: 'obj:limits', data: { mode: 'type', code: lt.code, reading: r.name, dir: (r.dirs[0] || {}).dir }, small: true }),
    };
  }
  function nextPhaseBox(readings, alerts) {
    const items = arr(readings).map((x) => `<li><span>${esc(x.name)}</span>${x.tag ? `<span class="mono">${esc(x.tag)}</span>` : ''}<span class="muted">${esc(x.note || 'on a connection')}</span></li>`)
      .concat(arr(alerts).map((x) => `<li><span>Alert: ${esc(x.name)}</span><span class="muted">${esc(x.note || 'reads a connection')}</span></li>`));
    if (!items.length) return '';
    return card({ title: H(`Next phase: connections ${chipNamed('next')}`), sub: 'Readings on pipes and lines between equipment come in the next phase. Nothing here raises an alert yet.', body: `<ul class="o-np">${items.join('')}</ul>`, tone: 'quiet' });
  }

  /* ── the object page ─────────────────────────────────────────────────────────────────────────────────── */
  function notFound(crumbs, text, back) {
    return UI.page({ crumbs, title: 'Not found', body: empty(text, back ? btn(back.label, { href: back.href }) : '') });
  }
  function tabsFor(base, counts, mode) {
    return TABS.map(([id, label]) => ({ id, label, href: base(id), count: counts[id] != null && counts[id] !== 0 ? counts[id] : '' }));
  }
  function render(o) {
    o = o || {};
    if (o.mode === 'type') return typePage(o.code, o.tab, o.aside);
    return equipmentHtml(o.plant, o.eqId, o.tab, o.aside);
  }

  function equipmentHtml(key, eqId, tab, aside) {
    const P = plantOf(key);
    const crumbs0 = [{ label: 'All Plants', href: '#/plants' }];
    if (!P) return notFound(crumbs0.concat([{ label: 'Not found' }]), 'This plant is not in the prototype.', { label: 'All Plants', href: '#/plants' });
    const e = eqOf(key, eqId);
    if (!e) return notFound(crumbs0.concat([{ label: P.name, href: plantHref(key) }, { label: 'Not found' }]), 'This equipment is not at this plant. The plant graph is the only source of equipment.', { label: 'Equipment at ' + P.name, href: plantHref(key, 'equipment') });
    tab = TABS.some((t) => t[0] === tab) ? tab : 'readings';
    const lt = libTypeOf(e);
    const props = pendingProposals(key, e.id);
    const all = arr(safe(() => V().readings(key, { eqId: e.id }), null) || safe(() => V().sensors(key, e.id), []));
    const recs = arr(safe(() => V().issues(key, { eqId: e.id }), []));
    const openRecs = recs.filter((i) => i.status !== 'closed').sort((x, y) => (RANK[y.band] || 0) - (RANK[x.band] || 0) || y.opened - x.opened);
    const tasks = arr(safe(() => V().tasks(key, { eqId: e.id }), []));
    const counts = { readings: all.filter((s) => !s.nextPhase).length, issues: openRecs.length, tasks: tasks.length };
    let body = '';
    if (tab === 'readings') body = instReadingsTab(key, P, e, all, props, lt);
    else if (tab === 'issues') body = instIssuesTab(key, P, e, recs, lt);
    else if (tab === 'tasks') body = instTasksTab(key, P, e, tasks, props);
    else body = instDetailsTab(key, P, e, all, lt);
    return UI.page({
      crumbs: crumbs0.concat([{ label: P.name, href: plantHref(key) }, { label: 'Equipment', href: plantHref(key, 'equipment') }, { label: e.tag }]),
      title: H(`<span class="o-tag">${esc(e.tag)}</span> ${esc(e.name)}`),
      chips: headChips(key, P, e),
      sub: `${e.typeName} at ${P.name} · ${plantStateLine(P)}`,
      actions: [btn('Phone view', { href: phoneHref(key, e.id), kind: 'ghost', title: 'The same page as operators see it on a phone' }), btn('Report a problem', { act: 'obj:report', data: { plant: key, eq: e.id } })],
      banner: instBanners(key, P, e, openRecs, props, all),
      tabs: tabsFor((id) => eqHref(key, e.id, id), counts), active: tab,
      body, aside, cls: 'pg-obj',
    });
  }
  function headChips(key, P, e) {
    const c = codeOf(e);
    return [
      c ? chip(e.typeName, { href: libHref(c), title: 'Its library type' }) : chip(e.typeName),
      chip(`Criticality: ${e.tierLabel || TIER[e.tier] || ''}`, { title: 'How much the plant depends on it' }) + ' ' + sourceChip(e.tierSource),
      /* v7: only when a Run status reading says so (its latest sample) */
      e.runState ? chip(e.runState === 'running' ? 'Running' : 'Stopped', { tone: e.runState === 'running' ? 'ok' : 'muted', title: 'From its Run status reading (sample)' }) : '',
    ].concat(W.V7STRUCT73 ? W.V7STRUCT73.chips(key, e.id) : []);
  }
  function instBanners(key, P, e, openRecs, props, all) {
    const out = [];
    if (openRecs.length) {
      const top = openRecs[0];
      const more = openRecs.length > 1 ? ` and ${plural(openRecs.length - 1, 'more')}` : '';
      const where = top.eqId !== e.id ? ` on ${tagOf(key, top.eqId)}, caused here` : '';
      out.push(banner(H(`<b>${esc(top.title)}</b> is open${esc(where)}: ${esc(bandName(top.band))}, opened ${esc(fmt(top.opened))}${top.commissioning ? ' · Commissioning' : ''}${esc(more)}.`), { tone: RANK[top.band] >= 3 ? 'bad' : 'warn', action: btn('Open the issue', { href: issueHref(key, top.id), small: true }) }));
    }
    if (e.notInDb) out.push(banner('Its type is not one of the database types, so it blocks go live. Fix it in the plant graph, then read again.', { tone: 'bad' }));
    else if (e.typeDiffers) out.push(banner(`Drawn as ${e.drawn}, stored as ${e.stored}. The stored type is what counts; fix the drawing in the plant graph, then read again.`, { tone: 'warn' }));
    const undecided = props.filter((p) => !p.decided && !p.blockedBy);
    if (undecided.length) out.push(banner(`${plural(undecided.length, 'library proposal')} for ${e.tag} ${undecided.length === 1 ? 'is' : 'are'} not decided yet. Go live waits for ${undecided.length === 1 ? 'it' : 'them'}.`, { tone: 'info', action: btn(undecided.length === 1 ? 'Decide it' : 'Decide them', { href: `${plantHref(key, 'library')}?eq=${encodeURIComponent(e.id)}`, small: true }) }));
    if (out.length < 2) {
      const noisy = arr(safe(() => V().alerts(key, { eqId: e.id }), [])).filter((al) => al.state === 'trial' && safe(() => V().isNoisy(key, al.id), false));
      if (noisy.length) { const al = noisy[0]; const ts = safe(() => V().trialStats(key, al.id), null); out.push(banner(`${al.name} is noisy: ${ts ? rt(ts.perDay) : 'over 10'} trial firings a day. Change its limits or how long they must hold.`, { tone: 'warn', action: btn('See its trial firings', { href: alertHref(key, al.id), small: true }) })); }
    }
    return out.slice(0, 2).join('');
  }

  function instReadingsTab(key, P, e, all, props, lt) {
    const scada = all.filter((s) => s.kind !== 'manual' && !s.nextPhase);
    const manual = all.filter((s) => s.kind === 'manual');
    const next = all.filter((s) => s.nextPhase);
    const models = scada.map((s) => instReadingModel(key, P, e, s, props));
    const order = models.map((m, i) => ({ m, i })).sort((x, y) => y.m.rank - x.m.rank || x.i - y.i).map((x) => x.m);
    const sample = true;            // DigitalPaani's layout is real; its readings are samples too
    let out = '';
    if (scada.length) {
      const sub = P.state === 'commissioning'
        ? 'Limits live on the reading; every alert on it follows them. During Commissioning, alerts only record trial firings, Emergencies included.'
        : 'Limits live on the reading; every alert on it follows them.';
      out += section('Readings from the plant graph', `<div class="o-rds">${order.map(readingCard).join('')}</div>`, { sub, actions: sample ? [sampleTag()] : [] });
    } else {
      const blocked = props.filter((p) => p.blockedBy);
      const why = blocked.length ? `<span class="o-hint" style="display:block">The library has ${plural(blocked.length, 'item')} for ${/^[AEIOU]/i.test(e.typeName) ? 'an' : 'a'} ${esc(e.typeName)} that ${blocked.length === 1 ? 'waits' : 'wait'} for readings the plant graph doesn't send: ${blocked.map((p) => `${esc(p.name)} (${esc(String(p.blockedBy).replace(/^Needs /, 'needs '))})`).join('; ')}.</span>` : '';
      out += section('Readings from the plant graph', empty(H(`The plant graph sends no readings for ${esc(e.tag)}.${why}`), btn('Fix it in the plant graph', { act: 'obj:scada', kind: 'ghost', small: true })));
    }
    if (manual.length) {
      const ms = manual.map((s) => instReadingModel(key, P, e, s, props));
      out += section('Manual and lab readings', `<div class="o-rds">${ms.map(readingCard).join('')}</div>`, { sub: 'Taken by hand or in the lab on a schedule. They use the same limits sheet; there are no samples to replay.' });
    }
    const npAlerts = lt && lt.nextPhase ? arr(lt.nextPhase.alerts) : [];
    out += nextPhaseBox(next.map((s) => ({ name: s.name, tag: s.tag, note: s.nextPhaseNote })), npAlerts);
    return out;
  }

  function issueItem(key, i, eqId) {
    const st = i.status === 'closed'
      ? `closed ${fmt(i.closed)}${i.falseAlarm ? ' as a false alarm' : ''}`
      : LBL('issueStatus', i.status);
    const chips = [];
    if (i.commissioning) chips.push(chip('Commissioning', { tone: 'warn', title: 'Opened during Commissioning: told to the Leads, kept out of the counts' }));
    if (eqId && i.causedBy === eqId && i.eqId !== eqId) chips.push(chip(`Opened on ${tagOf(key, i.eqId)}, caused here`, { tone: 'info' }));
    else if (i.causedBy && i.causedBy !== i.eqId) chips.push(chip(`Caused by ${tagOf(key, i.causedBy)}`, { tone: 'info' }));
    if (i.reported) chips.push(chip('Reported', { tone: 'muted' }));
    if (i.homeToConfirm) chips.push(chip('Where it belongs: to confirm', { tone: 'muted', title: 'Found by a report or lab test; which equipment it belongs to is still to confirm' }));
    return { title: i.title, href: issueHref(key, i.id), sub: `${bandName(i.band)} · opened ${fmt(i.opened)} · ${st}`, chips, tone: i.status === 'closed' ? '' : RANK[i.band] >= 3 ? 'bad' : 'warn' };
  }
  function issueTypesCard(typeName, types, opts) {
    const items = arr(types).map((t) => {
      const f = t.flowId ? safe(() => V().flowOf(t.flowId), null) : null;
      const bits = [foundByText(t.foundBy), f ? `starts ${f.name}` : 'no diagnostic yet', plural(t.causes || 0, 'root cause')];
      return { title: t.name, sub: bits.join(' · '), chips: t.homeToConfirm ? [chip('Where it belongs: to confirm', { tone: 'muted', title: 'Found by a report or lab test; which equipment it belongs to is still to confirm' })] : [] };
    });
    return card({
      title: `Problems the library knows for ${typeName}`,
      sub: 'From the workbook: how each one is found, and the diagnostic it starts.',
      body: items.length ? list(items) : empty(`The library lists no problems for ${typeName} yet.`),
      actions: opts && opts.actions,
    });
  }
  function instIssuesTab(key, P, e, recs, lt) {
    const open = recs.filter((i) => i.status !== 'closed').sort((x, y) => (RANK[y.band] || 0) - (RANK[x.band] || 0) || y.opened - x.opened);
    const closed = recs.filter((i) => i.status === 'closed').sort((x, y) => (y.closed || y.opened) - (x.closed || x.opened));
    const report = btn('Report a problem', { act: 'obj:report', data: { plant: key, eq: e.id }, kind: 'primary', small: true });
    const sub = P.state === 'commissioning'
      ? 'During Commissioning no alert opens an issue; you can still report a problem.'
      : 'Issues opened by its alerts, reported by people, or caused by it on other equipment.';
    let out = card({ title: open.length ? plural(open.length, 'open issue') : 'No open issues', sub, body: open.length ? list(open.map((i) => issueItem(key, i, e.id))) : '', actions: [report] });
    if (closed.length) out += card({ title: 'Closed', sub: closed.length > 10 ? `The latest 10 of ${closed.length}` : '', body: list(closed.slice(0, 10).map((i) => issueItem(key, i, e.id))) });
    const types = lt ? lt.issues : safe(() => V().issueTypes(e.typeName), []);
    out += issueTypesCard(e.typeName, types);
    out += `<p class="o-hint">All issues at ${esc(P.name)}: ${a(plantHref(key, 'issues'), 'Issues')}</p>`;
    return out;
  }

  function dueCell(t) {
    if (t.due == null) return H(`<span class="muted">${esc(t.statusLabel || 'Not scheduled')}</span>`);
    if (t.overdue) return H(`<span class="tx-bad">Overdue since ${esc(fmt(t.due))}</span>`);
    if (t.status === 'due') return H(`<span class="tx-warn">Due ${esc(fmt(t.due))}</span>`);
    return fmt(t.due);
  }
  function instTasksTab(key, P, e, tasks, props) {
    const rows = tasks.slice().sort((x, y) => (y.overdue ? 2 : y.status === 'due' ? 1 : 0) - (x.overdue ? 2 : x.status === 'due' ? 1 : 0) || (x.due == null ? 1e15 : x.due) - (y.due == null ? 1e15 : y.due)).map((t) => {
      const shared = t.eqIds && t.eqIds.length > 1 ? `Shared task for ${esc(String(t.line || '').split(' · ').pop() || plural(t.eqIds.length, 'piece'))}: ${esc(arr(t.tags).join(', '))}` : '';
      const conf = t.toConfirm ? ' ' + chip('to confirm', { tone: 'muted', title: 'One task per type at the plant, with a line per equipment: still to confirm' }) : '';
      return {
        task: H(`${a(taskHref(key, t.id), t.name)}${conf}<div class="muted small">${esc(t.workLabel || '')}${shared ? ' · ' + shared : ''}</div>`),
        every: H(`${esc(cap(t.everyText || everyText(t.every)))} ${t.source ? sourceChip(t.source) : ''}`),
        due: dueCell(t),
        last: t.lastDone ? fmtDay(t.lastDone) : H('<span class="muted">Not yet</span>'),
        act: t.every && t.every.n ? H(btn('Change how often', { act: 'obj:cadence', data: { plant: key, task: t.id }, small: true, kind: 'ghost' })) : '',
      };
    });
    const undecided = props.filter((p) => p.kind === 'task' && !p.decided && !p.blockedBy);
    const sub = P.state === 'commissioning' ? 'Tasks start at go live; first due dates are spread across each task\'s interval.' : 'Preventive maintenance and calibration stay on each piece of equipment; routine checks are one task per type at the plant.';
    let out = card({
      title: tasks.length ? plural(tasks.length, 'task') : 'No tasks yet', sub,
      body: tasks.length ? UI.table({ cols: [{ label: 'Task', key: 'task' }, { label: 'How often', key: 'every' }, { label: 'Next due', key: 'due', cls: 'nowrap' }, { label: 'Last done', key: 'last', cls: 'nowrap' }, { label: '', key: 'act', cls: 'r' }], rows }) : '',
    });
    if (undecided.length) out += note(H(`The library proposes ${plural(undecided.length, 'more task')} for ${esc(e.tag)}: ${undecided.map((p) => esc(p.name)).join(', ')}. ${a(plantHref(key, 'library'), 'Decide in What the library brings')}`), 'info');
    /* v7: condition-based work is the plant's, never this equipment's: say which of its readings raise some */
    const lw = arr(safe(() => V().lineWork(key, { eqId: e.id }), []));
    if (lw.length) out += note(H(`Condition-based work is filed at the plant. ${esc(e.tag)}'s readings raise ${lw.map((w) => `${a(taskHref(key, w.id), w.name)} (${esc(w.reading)}, ${esc(w.bandLabel)} line)`).join(' and ')}.`), 'quiet');
    out += `<p class="o-hint">Every task at ${esc(P.name)}: ${a(plantHref(key, 'tasks'), 'Tasks')}</p>`;
    return out;
  }

  function instDetailsTab(key, P, e, all, lt) {
    const c = codeOf(e);
    /* v7: the plant graph's answers with plain labels and units ("Motor rating 22 kW"), the same words as What the plant graph has */
    const form = e.form && typeof e.form === 'object' ? (UI.formAnswers ? UI.formAnswers(e.form).map((x) => { const m = /^(.+?) (\S.*)$/.exec(x); return m ? [m[1], m[2]] : [x, '']; }) : Object.keys(e.form).map((k) => [k, String(e.form[k])])) : [];
    const facts = [
      ['Tag', H(`<span class="mono">${esc(e.tag)}</span>`)],
      ['Name', e.name],
      ['Type in the database', H(`${c ? a(libHref(c), e.typeName) : esc(e.typeName)} ${c ? chip(c, { mono: true }) : ''}`)],
      ['Drawn as', e.typeDiffers ? H(`${esc(e.drawn)} <span class="tx-warn">· stored as ${esc(e.stored)}</span>`) : e.drawn],
      ['Readings', `${all.filter((s) => !s.nextPhase && s.kind !== 'manual').length} from the plant graph${all.some((s) => s.nextPhase) ? `, ${all.filter((s) => s.nextPhase).length} next phase` : ''}`],
    ].concat(form.length ? form.map(([k, v]) => [k, v]) : [['Form answers', H('<span class="muted">None in the plant graph</span>')]]);
    let out = card({
      title: 'From SCADA', sub: 'The plant graph is the only source of equipment, readings and answers. Fix it in the plant graph, then read again.',
      body: kv(facts) + (e.typeDiffers ? note(`Drawn as ${e.drawn}, stored as ${e.stored}: fix the drawing in the plant graph, then read again.`, 'warn') : '') + (e.notInDb ? note('Its type is not one of the database types: it blocks go live.', 'bad') : ''),
      actions: [btn('Fix it in the plant graph', { act: 'obj:scada', small: true, kind: 'ghost' })],
    });
    const ti = e.tierSource || {};
    const was = ti.chip && ti.chip !== 'lib' && ti.libValue && ti.libValue !== e.tier ? ` <span class="o-was">library ${esc(TIER[ti.libValue] || ti.libValue)}</span>` : '';
    out += card({
      title: 'Criticality', sub: 'How much the plant depends on it. A change here needs a note.',
      body: `<p><b>${esc(e.tierLabel || TIER[e.tier] || '')}</b> ${sourceChip(ti)}${was}</p>`,
      actions: [btn('Change', { act: 'obj:tier', data: { plant: key, eq: e.id }, small: true })],
    });
    const diffs = arr(safe(() => V().overrides({ plant: key }), [])).filter((o) => o.eqId === e.id);
    const rows = diffs.map((o) => ({
      what: o.what, here: o.plantValue,
      lib: H(`${esc(o.libValue)}${o.baseDiffers && o.baseValue ? `<div class="muted small">was ${esc(o.baseValue)} when changed</div>` : ''}`),
      why: H(`${esc(o.reasonLabel || '')}${o.note ? `<div class="muted small">${esc(o.note)}</div>` : ''}`),
      state: H(o.state === 'ok' && o.reason === 'unrecorded' ? chip('Reason not recorded', { tone: 'warn' }) : o.state === 'ok' && o.reason === 'notinlib' ? chip('Not in the library', { tone: 'info' }) : chip(o.state === 'same' && o.baseFrom === 'form' ? 'Now the same as the plant graph' : o.stateLabel || 'OK', { tone: o.state === 'libchanged' ? 'libchanged' : o.state === 'review' ? 'warn' : o.state === 'ended' ? 'muted' : 'ok' })),   /* v7: the same chip as Differences */
    }));
    out += card({
      title: 'Differences from the library', sub: diffs.length ? `Values on ${e.tag} that differ from the library, with why.` : '',
      body: diffs.length ? UI.table({ cols: [{ label: 'What', key: 'what' }, { label: 'Here', key: 'here' }, { label: 'Library', key: 'lib' }, { label: 'Why', key: 'why' }, { label: 'State', key: 'state' }], rows }) : empty(`None: everything on ${e.tag} follows the library or the plant graph.`),
      actions: [btn('All differences', { href: plantHref(key, 'differences'), small: true, kind: 'ghost' })],
    });
    out += nextPhaseBox(all.filter((s) => s.nextPhase).map((s) => ({ name: s.name, tag: s.tag, note: s.nextPhaseNote })), lt && lt.nextPhase ? lt.nextPhase.alerts : []);
    return out;
  }

  /* ── the library type, laid out like an equipment page ───────────────────────────────────────────────── */
  function typePage(code, tab, aside) {
    const lt = code ? safe(() => V().libType(code), null) : null;
    const crumbs0 = [{ label: 'Library', href: '#/library' }];
    if (!lt) return notFound(crumbs0.concat([{ label: 'Not found' }]), 'This type is not one of the database types.', { label: 'Library', href: '#/library' });
    tab = TABS.some((t) => t[0] === tab) ? tab : 'readings';
    const diffs = lt.draft ? arr(lt.draft.diffs) : [];
    const counts = { readings: arr(lt.readings).length, issues: arr(lt.issues).length, tasks: arr(lt.schedules).length };
    let body = '';
    if (tab === 'readings') body = typeReadingsTab(lt);
    else if (tab === 'issues') body = issueTypesCard(lt.typeName, lt.issues);
    else if (tab === 'tasks') body = typeTasksTab(lt);
    else body = typeDetailsTab(lt);
    const used = arr(lt.plants);
    const usedText = used.length ? `At ${plural(used.length, 'plant')}: ${used.map((p) => `${p.name} (${p.count})`).join(', ')}` : 'Not used at any plant yet';
    return UI.page({
      crumbs: crumbs0.concat([{ label: lt.typeName }]),
      title: lt.typeName,
      chips: [
        chip(`Library · version ${lt.version}`, { tone: 'info' }),
        diffs.length ? chip(`Draft · ${plural(diffs.length, 'change')}`, { tone: 'warn' }) : '',
        chip(lt.code, { mono: true, title: 'The database code' }),
        chip(`Criticality: ${TIER[lt.tier] || ''}`, { title: 'How much a plant depends on it' }) + ' ' + chipNamed('lib'),
      ],
      sub: `${lt.family}. ${usedText}.`,
      banner: diffs.length ? banner(`You are editing a draft of version ${lt.version + 1}: ${plural(diffs.length, 'change')}. No plant changes until it is published.`, { tone: 'warn' }) : '',
      tabs: tabsFor((id) => libHref(lt.code, id), counts), active: tab,
      body, aside, cls: 'pg-obj pg-type',
    });
  }
  function typeReadingsTab(lt) {
    const models = arr(lt.readings).map((r) => typeReadingModel(lt, r));
    let out = section('Readings and their limits', models.length ? `<div class="o-rds">${models.map(readingCard).join('')}</div>` : empty('The library lists no readings for this type.'), {
      sub: 'Library values reach every plant that follows them. Edits make a draft; nothing reaches a plant until it is published.',
    });
    const np = lt.nextPhase || {};
    out += nextPhaseBox(arr(np.readings), arr(np.alerts));
    return out;
  }
  function typeTasksTab(lt) {
    const dr = lt.draft || null;
    const rows = arr(lt.schedules).map((x) => {
      const draftEv = x.draftEvery || (dr && dr.schedules ? dr.schedules[x.name] : null);
      const evText = draftEv ? `${esc(cap(x.draftEveryText || everyText(draftEv)))} <span class="o-was">was ${esc(x.everyText)}</span> ${draftChip()}` : `${esc(cap(x.everyText))} ${chipNamed('lib')}`;
      return {
        task: H(`<b>${esc(x.name)}</b><div class="muted small">${esc(x.workLabel || '')}</div>`),
        every: H(evText),
        act: x.every && x.every.n ? H(btn('Change how often', { act: 'obj:cadence', data: { mode: 'type', code: lt.code, schedule: x.name }, small: true, kind: 'ghost' })) : '',
      };
    });
    let out = card({
      title: plural(rows.length, 'task'), sub: 'They travel with the type to every plant. Routine checks become one task per type at a plant.',
      body: rows.length ? UI.table({ cols: [{ label: 'Task', key: 'task' }, { label: 'How often', key: 'every' }, { label: '', key: 'act', cls: 'r' }], rows }) : empty('The library has no tasks for this type.'),
    });
    const gt = arr(lt.generalTasks);
    if (gt.length) out += card({ title: 'General tasks from the workbook', sub: 'Fix steps link to these, and each plant runs them as tasks.', body: list(gt.map((t) => ({ title: t.name, sub: String(t.frequency || '').split('\n')[0] || '' }))) });
    return out;
  }
  /* v7: the catalogue's "to confirm" line, without the doubled prefix, with "from v1" in words, and marked once a version changed it */
  function confirmNote(lt) {
    if (!lt.confirm) return '';
    let text = String(lt.confirm).replace(/\bfrom v1\b/g, 'kept from the first study').replace(/\bv1\b/g, 'the first study');
    const m = /^(.+?) limits to confirm:\s*/.exec(text); const reading = m ? m[1] : null; if (m) text = `${reading} limits: ${text.slice(m[0].length)}`;
    const later = reading ? arr(lt.changes).filter((c) => arr(c.diffs).some((d) => d.reading === reading)).sort((a, b) => b.at - a.at)[0] : null;
    if (later) { const ds = arr(later.diffs).filter((d) => d.reading === reading).map((d) => `${d.what.replace(/^.*? · /, '')} ${d.to == null ? 'removed' : fv(d.to, (V().libLimits(lt.typeName, reading, d.dir) || {}).unit || '', '')}`); return note(`${text} Since then, version ${later.version} set ${ds.join(', ')}.`, 'quiet'); }
    return note(`To confirm: ${text}`, 'warn');
  }
  function typeDetailsTab(lt) {
    const used = arr(lt.plants);
    let out = card({
      title: 'About this type',
      body: kv([
        ['Database type', H(`${esc(lt.typeName)} ${chip(lt.code, { mono: true })}`)],
        ['Family', lt.family],
        ['Version', H(`${esc(lt.version)}${lt.draft ? ` ${chip('a draft is open', { tone: 'warn' })}` : ''}`)],
        ['Criticality', H(`${esc(TIER[lt.tier] || '')} ${chipNamed('lib')}`)],
        ['Used at', used.length ? H(used.map((p) => `${a(plantHref(p.key, 'equipment'), p.name)} <span class="muted">(${esc(plural(p.count, 'piece'))})</span>`).join(' · ')) : H('<span class="muted">No plant yet</span>')],
      ]) + confirmNote(lt),
    });
    const ch = arr(lt.changes).slice().sort((x, y) => y.at - x.at);
    out += card({
      title: 'Changes', sub: 'Each published version, newest first.',
      body: ch.length ? list(ch.map((c) => ({ title: `Version ${c.version} · ${fmtDay(c.at)}${c.kind === 'safety' ? ' · safety change' : ''}`, sub: H(`${esc(c.text || '')}${c.note ? `<br><span class="muted">${esc(c.note)}</span>` : ''}`), right: c.who || '' }))) : empty(`No changes since version 1.`),
    });
    const sg = arr(lt.suggestions);
    out += card({
      title: 'Suggestions for the library', sub: 'From plants that think the library is wrong.',
      body: sg.length ? list(sg.map((s) => ({ title: H(esc(s.text)), sub: `${s.plant ? UI.plantName(s.plant) + ' · ' : ''}${s.who || ''} · ${fmtDay(s.at)}` }))) : empty('None yet.'),
      actions: [btn('Suggest a library change', { act: 'obj:suggest', data: { code: lt.code }, small: true })],
    });
    const np = lt.nextPhase || {};
    out += nextPhaseBox(arr(np.readings), arr(np.alerts));
    return out;
  }

  /* ── routes: equipment page and phone view ───────────────────────────────────────────────────────────── */
  function equipmentPage(params) { return equipmentHtml(params.plant, params.id, params.tab, null); }

  function spark(points, o) {
    const pts = arr(points).filter((p) => p && isFinite(p.v));
    if (pts.length < 2) return '';
    const w = 320; const h = 64; const pad = 4;
    const lines = BANDS.filter((b) => o && o.bands && num(o.bands[b]) != null).map((b) => ({ b, v: +o.bands[b] }));
    const vs = pts.map((p) => +p.v).concat(lines.map((l) => l.v));
    let lo = Math.min(...vs); let hi = Math.max(...vs); if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const x = (i) => (i / (pts.length - 1)) * w;
    const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (h - 2 * pad);
    const poly = pts.map((p, i) => `${x(i).toFixed(1)},${y(+p.v).toFixed(1)}`).join(' ');
    const ln = lines.map((l) => `<line class="o-sp-l o-sp-${l.b}" x1="0" x2="${w}" y1="${y(l.v).toFixed(1)}" y2="${y(l.v).toFixed(1)}"/>`).join('');
    return `<svg class="o-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(o && o.label || 'The last 24 hours')}">${ln}<polyline points="${poly}" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function phoneCta(key, P, e, openRecs, tasks, models) {
    if (openRecs.length) {
      const i = openRecs[0];
      return `<div class="o-ph-cta tone-${RANK[i.band] >= 3 ? 'bad' : 'warn'}">${sev(i.band)}<h3>${esc(i.title)}</h3><p>Opened ${esc(fmt(i.opened))} · ${esc(LBL('issueStatus', i.status))}${openRecs.length > 1 ? ` · ${plural(openRecs.length - 1, 'more open')}` : ''}</p>${btn('Open the issue', { href: issueHref(key, i.id), kind: 'primary' })}</div>`;
    }
    const due = tasks.filter((t) => t.overdue || t.status === 'due');
    if (due.length) {
      const t = due[0];
      return `<div class="o-ph-cta tone-warn"><h3>${esc(t.overdue ? 'Overdue' : 'Due')}: ${esc(t.name)}</h3><p>${esc(cap(t.everyText || ''))}${due.length > 1 ? ` · ${plural(due.length - 1, 'more due')}` : ''}</p>${btn('Open the task', { href: taskHref(key, t.id), kind: 'primary' })}</div>`;
    }
    const past = models.find((m) => m.where);
    if (past) return `<div class="o-ph-cta tone-${toneOfBand(past.where)}"><h3>${esc(past.s.name)} is in ${esc(bandName(past.where))}</h3><p>Not an issue yet: it must hold past the limit first.</p>${btn('See the reading', { href: phoneHref(key, e.id, past.s.id), kind: 'primary' })}</div>`;
    if (P.state === 'commissioning') return '<div class="o-ph-cta"><h3>On trial</h3><p>Nothing reaches this phone until the plant goes live.</p></div>';
    return `<div class="o-ph-cta tone-ok"><h3>All quiet</h3><p>${models.length ? 'Every reading is inside its limits. Nothing is due.' : 'Nothing is open and nothing is due.'}</p></div>`;
  }
  function phoneModels(key, e) {
    return arr(safe(() => V().sensors(key, e.id), [])).filter((s) => !s.nextPhase).map((s) => {
      const v = s.latest ? num(s.latest.v) : null; const dirs = arr(s.dirs);
      const lims = dirs.map((dir) => ({ dir, lim: safe(() => V().limitsOf(key, s.id, dir), null) })).filter((x) => x.lim);
      let where = null; let whereDir = dirs[0] || null;
      lims.forEach((x) => { const b = bandNow(v, x.dir, x.lim.bands, s.kind); if (b && (!where || RANK[b] > RANK[where])) { where = b; whereDir = x.dir; } });
      return { s, v, lims, where, dir: whereDir || s.primaryDir || dirs[0] || null };
    });
  }
  function phoneHome(key, P, e) {
    const recs = arr(safe(() => V().issues(key, { eqId: e.id }), [])).filter((i) => i.status !== 'closed').sort((x, y) => (RANK[y.band] || 0) - (RANK[x.band] || 0) || y.opened - x.opened);
    const tasks = arr(safe(() => V().tasks(key, { eqId: e.id }), []));
    const models = phoneModels(key, e);
    const rows = models.map((m) => {
      const lim = m.lims.find((x) => x.dir === m.dir) || m.lims[0];
      const bar = lim && hasLimits(lim.lim) && m.s.kind !== 'status' ? bandBar({ dir: lim.dir, bands: lim.lim.bands, value: m.v, valid: validFor(m.s), unit: m.s.unit, compact: true }) : '';
      const subTxt = m.where ? `In ${bandName(m.where)}` : lim && hasLimits(lim.lim) ? 'Inside the limits' : m.s.kind === 'meter' ? 'Counts up' : 'No limits';
      const shown = m.s.unit === 'pH' && /^pH$/i.test(m.s.name) ? num(m.v) == null ? '—' : String(fv(m.v, '', m.s.kind)) : fv(m.v, m.s.unit, m.s.kind);   /* v7: the name already says pH */
      return `<li><a href="${esc(phoneHref(key, e.id, m.s.id))}"><span>${esc(m.s.name)}</span><span class="o-v${m.where ? ' tx-' + toneOfBand(m.where) : ''}">${esc(shown)}</span><span class="o-go" aria-hidden="true">›</span>${bar}<span class="o-sub">${esc(subTxt)}</span></a></li>`;
    }).join('');
    const next = tasks.filter((t) => t.due != null).sort((x, y) => x.due - y.due).slice(0, 3);
    const taskRows = next.map((t) => `<li><a href="${esc(taskHref(key, t.id))}"><span>${esc(t.name)}</span><span class="o-v${t.overdue ? ' tx-bad' : ''}">${esc(t.overdue ? 'Overdue' : fmtDay(t.due))}</span><span class="o-go" aria-hidden="true">›</span></a></li>`).join('');
    return `<div class="o-ph-top"><span class="mono">${esc(e.tag)}</span><h2>${esc(e.name)}</h2><p>${esc(e.typeName)} · ${esc(e.tierLabel || TIER[e.tier] || '')}${e.runState ? ` · ${e.runState === 'running' ? 'Running' : 'Stopped'}` : ''}</p></div>`
      + phoneCta(key, P, e, recs, tasks, models)
      + `<h3 class="o-ph-h">Readings ${sampleTag()}</h3>${rows ? `<ul class="o-ph-list">${rows}</ul>` : '<p class="muted">The plant graph sends no readings for this equipment.</p>'}`
      + (taskRows ? `<h3 class="o-ph-h">Next tasks</h3><ul class="o-ph-list">${taskRows}</ul>` : '')
      + `<div class="o-ph-btns">${btn('Report a problem', { act: 'obj:report', data: { plant: key, eq: e.id } })}</div>`;
  }
  function phoneReading(key, P, e, sensorId) {
    const m = phoneModels(key, e).find((x) => x.s.id === sensorId);
    const back = `<a class="o-ph-back" href="${esc(phoneHref(key, e.id))}">‹ ${esc(e.tag)}</a>`;
    if (!m) return back + '<p class="muted">This reading is not on this equipment.</p>';
    const s = m.s; const lim = m.lims.find((x) => x.dir === m.dir) || m.lims[0];
    const t1 = now(); const pts = s.kind === 'meter' ? [] : arr(safe(() => V().series(key, s.id, t1 - DAY, t1, 15), []));
    const sp = spark(pts, { bands: lim ? lim.lim.bands : null, label: `${s.name} over the last 24 hours` });
    const alerts = arr(safe(() => V().alerts(key, { sensorId: s.id }), []));
    const whereTxt = m.v == null ? 'No reading yet' : m.where ? `in ${bandName(m.where)}` : lim && hasLimits(lim.lim) ? 'inside the limits' : '';
    return back
      + `<div><h2>${esc(s.name)}</h2><p class="mono muted">${esc(s.tag || '')}</p></div>`
      + `<div class="o-ph-now"><b>${esc(fv(m.v, s.unit, s.kind))}</b><span class="${m.where ? 'tx-' + toneOfBand(m.where) : 'muted'}">${esc(whereTxt)}</span> ${sampleTag()}</div>`
      + (sp ? `${sp}<div class="o-spark-c"><span>24 hours ago</span><span>now</span></div>` : '')
      + m.lims.map((x) => `<div class="o-dir">${m.lims.length > 1 ? `<div class="o-dir-k">${esc(dirHead(x.dir))}</div>` : ''}${s.kind !== 'status' && hasLimits(x.lim) ? `<div class="o-dir-bar">${bandBar({ dir: x.dir, bands: x.lim.bands, value: m.v, valid: validFor(s), unit: s.unit })}</div>` : ''}${limitsLine(x.lim, s, 'instance')}</div>`).join('')
      + (alerts.length ? `<div class="o-al">${alerts.map((al) => alertLine(key, al)).join('')}</div>` : '')
      + `<div class="o-ph-btns">${m.lims.length || s.takesLimits && s.kind !== 'meter' && s.kind !== 'status' ? btn('Change limits', { act: 'obj:limits', data: { plant: key, sensor: s.id, dir: m.dir }, kind: 'primary' }) : ''}</div>`
      + '<p class="o-hint">Limits are read-only on the phone. Change limits opens the same sheet as the full page.</p>';
  }
  function phonePage(params) {
    const key = params.plant; const P = plantOf(key);
    const crumbs0 = [{ label: 'All Plants', href: '#/plants' }];
    if (!P) return notFound(crumbs0.concat([{ label: 'Not found' }]), 'This plant is not in the prototype.', { label: 'All Plants', href: '#/plants' });
    const e = eqOf(key, params.id);
    if (!e) return notFound(crumbs0.concat([{ label: P.name, href: plantHref(key) }, { label: 'Not found' }]), 'This equipment is not at this plant.', { label: 'Equipment at ' + P.name, href: plantHref(key, 'equipment') });
    const r = params._q && params._q.r;
    const screen = r ? phoneReading(key, P, e, r) : phoneHome(key, P, e);
    const side = `<div class="o-phone-side"><h2>The Equipment Card</h2>`
      + `<p>This is the same equipment page, as an operator carries it: the one thing to do now comes first, then the readings, then Report a problem.</p>`
      + `<p>It is not a second place to configure. Limits are read-only here; Change limits opens the same sheet as the full page, so a value has one home.</p>`
      + (P.state === 'commissioning' ? `<p>${esc(P.name)} is in Commissioning: nothing reaches this phone yet.</p>` : '')
      + `<p>${btn('Back to the full page', { href: eqHref(key, e.id) })}</p></div>`;
    return UI.page({
      crumbs: crumbs0.concat([{ label: P.name, href: plantHref(key) }, { label: 'Equipment', href: plantHref(key, 'equipment') }, { label: e.tag, href: eqHref(key, e.id) }, { label: 'Phone view' }]),
      title: H(`<span class="o-tag">${esc(e.tag)}</span> ${esc(e.name)}`),
      chips: headChips(key, P, e),
      sub: 'Phone view: the Equipment Card.',
      actions: [btn('Full page', { href: eqHref(key, e.id), kind: 'ghost' })],
      body: `<div class="o-phone-lay">${UI.phone(screen, { caption: r ? 'One reading, one decision.' : 'What an operator sees for this equipment.' })}${side}</div>`,
      cls: 'pg-obj pg-phone',
    });
  }

  /* ── the alert page ──────────────────────────────────────────────────────────────────────────────────── */
  function proposalFor(key, al) {
    return pendingProposals(key, al.eqId).find((p) => p.kind === 'alert' && !p.blockedBy && (p.name === String(al.name).split(' — ')[0]) && (!p.sensorId || p.sensorId === al.sensorId)) || null;
  }
  function stateCard(key, P, al) {
    const live = P.state === 'live'; const prop = al.state === 'draft' ? proposalFor(key, al) : null;
    const pid = prop && !prop.decided ? prop.pid : null;
    const d = { plant: key, alert: al.id };
    let sub = ''; const acts = [];
    if (al.state === 'draft') {
      sub = pid ? 'Proposed by the library and not decided yet. Accepting puts it On trial: it records trial firings and nothing is sent.' : 'A draft reads nothing. Put it On trial to see how often it would fire.';
      acts.push(btn(pid ? 'Accept: put it On trial' : 'Put it On trial', { act: 'obj:astate', data: Object.assign({ to: 'trial', pid }, d), kind: 'primary', small: true }));
      acts.push(btn(pid ? 'Not for this plant' : 'Turn off', { act: 'obj:astate', data: Object.assign({ to: 'off', pid }, d), small: true }));
    } else if (al.state === 'trial') {
      sub = live
        ? `On trial${al.trialUntil ? ` until ${fmtDay(al.trialUntil)}` : ''}: firings are recorded, nothing is sent. After 7 days it turns On.`
        : 'On trial: firings are recorded and nothing is sent. It turns On when the plant goes live.';
      if (live) acts.push(btn('Turn on now', { act: 'obj:astate', data: Object.assign({ to: 'on' }, d), kind: 'primary', small: true }));
      else acts.push(btn('Turn on', { disabled: true, small: true, title: 'Alerts turn On at go live' }));
      acts.push(btn('Turn off', { act: 'obj:astate', data: Object.assign({ to: 'off' }, d), small: true }));
    } else if (al.state === 'on') {
      sub = 'On: a firing opens an issue and people are told by its severity.';
      acts.push(btn('Turn off', { act: 'obj:astate', data: Object.assign({ to: 'off' }, d), small: true }));
    } else {
      sub = 'Off: it reads nothing and nobody is told.';
      acts.push(btn('Put it On trial', { act: 'obj:astate', data: Object.assign({ to: 'trial' }, d), kind: 'primary', small: true }));
      if (live) acts.push(btn('Turn on', { act: 'obj:astate', data: Object.assign({ to: 'on' }, d), small: true }));
    }
    return card({ title: H(`State ${stateChip(al.state)}`), sub, actions: acts, tone: al.state === 'draft' ? 'info' : '' });
  }
  function dayBars(ts) {
    const from = ts.since || ts.from; const to = ts.to || now();
    const days = []; let t = from;
    while (t <= to + 1 && days.length < 40) { const label = fmtDay(t); if (!days.length || days[days.length - 1].label !== label) days.push({ label, n: 0 }); t += HOUR; }
    arr(ts.firings).forEach((f) => { const label = fmtDay(f.start); const d = days.find((x) => x.label === label); if (d) d.n++; });
    const max = Math.max(12, ...days.map((d) => d.n));
    const px = (n) => Math.round((n / max) * 92);
    const bars = days.map((d) => `<div class="o-day${d.n > 10 ? ' noisy' : ''}" title="${esc(d.label)}: ${esc(plural(d.n, 'trial firing'))}"><b>${d.n}</b><i style="height:${px(d.n)}px"></i><small>${esc(d.label.replace(/ \w+$/, ''))}</small></div>`).join('');
    return `<div class="o-days" role="img" aria-label="Trial firings per day, against the noisy line at 10 a day">${bars}<div class="o-days-line" style="bottom:${19 + px(10)}px"><span>10 a day</span></div></div>`;
  }
  function firingsTable(fs, s, limit) {
    const rows = fs.slice().sort((x, y) => y.start - x.start).slice(0, limit).map((f) => ({
      start: fmt(f.start),
      band: H(`${sev(f.band)}${f.steps && f.steps.length ? ' <span class="muted small">stepped up</span>' : ''}`),
      peak: fv(f.peak, s.unit, s.kind),
      lasted: f.end == null ? H('<span class="tx-warn">still going</span>') : fdur(f.minutes),
      short: H(f.short ? chip('Short', { tone: 'muted', title: '30 min or less, and the peak within 10% of the limit' }) : ''),
    }));
    return UI.table({ cols: [{ label: 'Started', key: 'start', cls: 'nowrap' }, { label: 'Band', key: 'band' }, { label: 'Peak', key: 'peak', cls: 'nowrap' }, { label: 'Lasted', key: 'lasted', cls: 'nowrap' }, { label: '', key: 'short' }], rows, empty: 'No trial firings yet.' });
  }
  /* v7 (card D24): the trial firings as they happened (kept, never recounted) and, beside them, a replay of the trial with today's
     limits; the noisy mark and go live judge today's limits, so a fix shows at once and nothing is erased */
  function trialCard(key, P, al, s, ts, q) {
    const all = q && q.all === '1';
    const rec = ts.recorded || { count: ts.count, perDay: ts.perDay, firings: ts.firings, shortShare: ts.shortShare, days: ts.days };
    const days = n1(ts.trialDays || ts.days); const differs = rec.count !== ts.count;
    const shortPct = Math.round((rec.shortShare || 0) * 100);
    const st = stats([
      { value: String(rec.count), label: `trial firings in ${days} days, as they happened` },
      { value: rt(ts.perDay), label: "a day with today's limits", tone: ts.noisy ? 'warn' : '' },
      { value: `${shortPct}%`, label: 'short: 30 min or less, near the limit' },
    ]);
    const today = `<p class="o-today">With today's limits: <b>${esc(String(ts.count))}</b> in ${esc(days)} days${differs ? ' (the limits changed during the trial; the firings below are kept as they happened)' : ''}.</p>`;
    const verdict = ts.noisy
      ? note("Noisy: more than 10 trial firings a day with today's limits, over its trial so far. Move a limit, or make it hold longer before it fires.", 'warn')
      : ts.mostlyShort
        ? note('Mostly short: most firings lasted 30 min or less and peaked within 10% of the limit. Busy, but not noisy.', 'quiet')
        : ts.count ? note("Not noisy: 10 trial firings a day or fewer with today's limits.", 'ok') : note(rec.count ? "Not noisy: with today's limits none of these would have fired." : 'No trial firings with these limits.', rec.count ? 'ok' : 'quiet');
    const fs = arr(rec.firings);
    const more = fs.length > 12 ? `<p class="o-hint">${all ? a(alertHref(key, al.id), 'Show the latest 12') : a(alertHref(key, al.id) + '?all=1', `Show all ${fs.length}`)}</p>` : '';
    const hist = { ...ts, firings: fs, count: rec.count, perDay: rec.perDay };
    return card({
      title: H(`Trial firings ${sampleTag()}`),
      sub: P.state === 'commissioning' ? 'Each one is an issue that would have opened. Nothing was sent.' : 'Recorded while on trial. Nothing was sent.',
      body: st + today + `<div class="o-verdict">${verdict}</div>` + `<div class="mt">${dayBars(hist)}</div>` + (fs.length ? `<div class="mt">${firingsTable(fs, s, all ? 500 : 12)}</div>` : '') + more,
      tone: ts.noisy ? 'warn' : '',
    });
  }
  function limitsCard(key, al, s) {
    const lim = safe(() => V().limitsOf(key, al.sensorId, al.dir), null);
    const v = s && s.latest ? num(s.latest.v) : null;
    const sx = s || { unit: al.unit, kind: al.kind, name: al.sensorName };
    const bar = lim && hasLimits(lim) && sx.kind !== 'status' ? `<div class="o-dir-bar">${bandBar({ dir: al.dir, bands: lim.bands, value: v, valid: validFor(sx), unit: sx.unit })}</div>` : '';
    return card({
      title: H(`${esc(al.sensorName || 'Reading')} <span class="mono muted">${esc(al.sensorTag || '')}</span>`),
      sub: `${al.kind === 'status' ? `Fires when it reads ${al.dir === 'below' ? 'OFF' : 'ON'}.` : `${dirHead(al.dir)} its limits.`} Limits live on the reading, so every alert on it follows them.`,
      body: bar + (lim ? limitsLine(lim, sx, 'instance') : chipNamed('none')) + lineWorkHtml(key, al.sensorId, al.dir),
      actions: [btn('Change limits', { act: 'obj:limits', data: { plant: key, sensor: al.sensorId, dir: al.dir }, small: true, kind: 'primary' })],
    });
  }
  function timingCard(key, al) {
    const row = (label, t) => [label, H(`${esc(t && t.value != null ? t.value : '—')} min ${t ? sourceChip(t) : ''}${t && t.chip !== 'lib' && t.libValue != null && !same(t.libValue, t.value) ? ` <span class="o-was">library ${esc(t.libValue)} min</span>` : ''}`)];
    const set = BANDS.filter((b) => al.bands && num(al.bands[b]) != null);
    const clock = set.map((b) => `<li>${sev(b)}<span>${esc(sevClock(b))}</span></li>`).join('');
    return card({
      title: 'Must hold for, must clear for',
      sub: 'A firing starts once the reading has been past a limit this long, and ends once it has been back inside this long.',
      body: kv([row('Must hold for', al.hold), row('Must clear for', al.clear)])
        + `<p class="o-hint">Emergency fires on the first reading, whatever must hold for says.</p>`
        + (set.length ? `<div class="mt"><h3 class="small">Start by / fix by follow the severity</h3><ul class="o-clock">${clock}</ul><p class="o-hint">Set by severity for every alert; there is nothing to set here.</p></div>` : ''),
      actions: [btn('Change times', { act: 'obj:timing', data: { plant: key, alert: al.id }, small: true })],
    });
  }
  /* v7: the window Results counts over (Coverage's): "Since go live, Thu 29 Oct, 09:00" under a day; otherwise "Last N days" */
  function covWindow(key) {
    const c = safe(() => V().coverage(key), null);
    const P = plantOf(key); const fresh = P && P.state === 'live' && P.since != null && now() - P.since < DAY;
    const dn = c && c.days ? Math.round(c.days) : 30;
    return { c, from: c && isNum(c.from) ? c.from : now() - dn * DAY, span: fresh ? `Since go live, ${fmt(P.since)}` : `Last ${plural(dn, 'day')}`, lower: fresh ? 'since go live' : `last ${plural(dn, 'day')}` };
  }
  function liveCard(key, al) {
    const r = covRow(key, al.id); const span = covWindow(key).span;
    if (!r || !r.issues) return card({ title: H(`Results ${sampleTag()}`), sub: span, body: empty('No issues from this alert in that time.') });
    const rateF = rt; const durF = UI.dur || ((m) => `${n1(m / 60)} h`);
    return card({
      title: H(`Results ${sampleTag()}`), sub: `${span}. Commissioning issues are kept out of these counts.`,
      body: stats([
        { value: rateF(r.firesPerDay), label: 'issues a day' },
        { value: r.falseAlarmShare == null ? '—' : `${Math.round(r.falseAlarmShare * 100)}%`, label: 'closed as false alarms', tone: r.falseAlarmShare >= 0.5 ? 'warn' : '' },
        { value: r.medianCloseMin != null ? durF(r.medianCloseMin) : r.medianCloseH == null ? '—' : durF(r.medianCloseH * 60), label: 'median time to close' },
        { value: String(r.issues), label: `${r.issues === 1 ? 'issue' : 'issues'} in that time` },
      ]),
    });
  }
  function toldText(i) {
    if (i.commissioning) return 'Told to the Leads by WhatsApp and in the app; no call, no hooter.';
    const ws = [...new Set(arr(i.told).map((t) => t.who))];
    return ws.length ? `Told ${ws.length} ${ws.length === 1 ? 'person' : 'people'}` : '';
  }
  function alertPage(params) {
    const key = params.plant; const id = params.id; const P = plantOf(key);
    const crumbs0 = [{ label: 'All Plants', href: '#/plants' }];
    if (!P) return notFound(crumbs0.concat([{ label: 'Not found' }]), 'This plant is not in the prototype.', { label: 'All Plants', href: '#/plants' });
    const al = safe(() => V().alert(key, id), null);
    if (!al) return notFound(crumbs0.concat([{ label: P.name, href: plantHref(key) }, { label: 'Not found' }]), 'This alert is not at this plant.', { label: P.name, href: plantHref(key) });
    const e = al.eqId ? eqOf(key, al.eqId) : null;
    const s = readingOf(key, al.sensorId);
    const ts = safe(() => V().trialStats(key, id), null);
    const recs = arr(safe(() => V().issues(key, {}), [])).filter((i) => i.alertId === id);
    const open = recs.filter((i) => i.status !== 'closed');
    const live = P.state === 'live';
    const bans = [];
    if (open.length) {
      const i = open[0];
      bans.push(banner(H(`<b>${esc(i.title)}</b> is open at ${esc(bandName(i.band))}, since ${esc(fmt(i.opened))}. It keeps the terms it opened under; a change here applies to the next one.`), { tone: RANK[i.band] >= 3 ? 'bad' : 'warn', action: btn('Open the issue', { href: issueHref(key, i.id), small: true }) }));
    }
    if (!live && al.state === 'trial') bans.push(banner('Commissioning: nothing is sent, Emergencies included; each firing is recorded as a trial firing. On a new plant that includes an Emergency. A plant that was Live keeps its Emergencies real.', { tone: 'info' }));
    /* v7: the list is all time; say how many of them fall in the window Results counts over, so the two numbers never seem to disagree */
    const win = covWindow(key); const inWin = recs.filter((i) => !i.commissioning && i.opened >= win.from).length;
    const issuesCard = recs.length ? card({
      title: plural(recs.length, 'issue') + ' it opened, all time',
      sub: [live && inWin !== recs.length ? `${inWin} of them in the ${win.lower}, as counted in Results` : '', open.length ? `${open.length} open` : 'All closed', recs.length > 10 ? 'the latest 10 shown' : ''].filter(Boolean).join(' · '),
      body: list(recs.slice().sort((x, y) => (x.status === 'closed') - (y.status === 'closed') || y.opened - x.opened).slice(0, 10).map((i) => { const it = issueItem(key, i, null); const t = toldText(i); if (t) it.sub += ` · ${t}`; return it; })),
    }) : '';
    const flow = al.flowId ? safe(() => V().flowOf(al.flowId), null) : null;
    const steps = flow ? arr(flow.steps).slice(0, 10) : [];
    const diagCard = card({
      title: 'Diagnostic it opens', sub: 'From the library; read-only here.',
      body: flow ? `<p><b>${esc(flow.name)}</b> <span class="muted">· ${esc(plural(arr(flow.steps).length, 'step'))}</span></p>${steps.length ? `<details class="o-more"><summary>See its steps</summary><ol class="o-steps">${steps.map((x) => `<li>${esc(x.text || '')}</li>`).join('')}</ol></details>` : ''}` : empty('No diagnostic in the library for this alert yet.'),
      tone: 'quiet',
    });
    const parts = [];
    if (al.state === 'draft') parts.push(stateCard(key, P, al));
    if (ts && (al.state === 'trial' || !live)) parts.push(trialCard(key, P, al, s || { unit: al.unit, kind: al.kind }, ts, params._q));
    if (live && al.state === 'on') { parts.push(liveCard(key, al)); parts.push(issuesCard); }
    parts.push(limitsCard(key, al, s));
    parts.push(timingCard(key, al));
    if (al.state !== 'draft') parts.push(stateCard(key, P, al));
    if (!(live && al.state === 'on')) parts.push(issuesCard);
    parts.push(diagCard);
    const what = `Watches ${al.sensorName || 'a reading'}${al.sensorTag ? ` (${al.sensorTag})` : ''}${e ? ` on ${e.tag}` : ''}, ${al.kind === 'status' ? 'for its state' : `${al.dir === 'below' ? 'falling below' : 'rising above'} its limits`}.`;
    return UI.page({
      crumbs: crumbs0.concat([{ label: P.name, href: plantHref(key) }, { label: 'Equipment', href: plantHref(key, 'equipment') }].concat(e ? [{ label: e.tag, href: eqHref(key, e.id) }] : []).concat([{ label: al.name }])),
      title: al.name,
      chips: [stateChip(al.state), al.fromLibrary ? chipNamed('lib') : chip('Not in the library', { tone: 'changed' }), e ? chip(e.tag, { mono: true, href: eqHref(key, e.id), title: 'Its equipment' }) : ''],
      sub: what,
      banner: bans.slice(0, 2).join(''),
      body: parts.filter(Boolean).join(''),
      cls: 'pg-obj pg-alert',
    });
  }

  /* ── sheets: shared bits ──────────────────────────────────────────────────────────────────────────────── */
  let LS = null;           // the open limits sheet
  let VS = null;           // the open small value sheet (timing, cadence, tier)
  let MOD = null;          // the open modal's element
  let prevTimer = null;
  const q1 = (el, sel) => (el && typeof el.querySelector === 'function' ? el.querySelector(sel) : null);
  const qa = (el, sel) => (el && typeof el.querySelectorAll === 'function' ? Array.prototype.slice.call(el.querySelectorAll(sel)) : []);
  function setHidden(node, hide) { if (!node) return; if (hide) node.setAttribute('hidden', ''); else node.removeAttribute('hidden'); }
  function setHtml(node, html) { if (node) node.innerHTML = html; }
  function reviewDay() { return fmtDay(now() + 182 * DAY); }
  function whyHtml(st, redirects) {
    const until = st.until || isoDay(now() + 30 * DAY);
    const base = st.baseFrom === 'form' ? 'plant graph' : 'library';   /* v7: what this plant's value differs from */
    if (true) return `<div class="o-why"${st.showWhy ? '' : ' hidden'}><h3>This becomes the plant's own value</h3><p class="o-hint">It stops following the ${base} until someone sends it back.</p>` + UI.field({ label: 'Why', hint: 'What makes this plant different. Required.', html: `<textarea class="o-note" rows="3" aria-label="Why" placeholder="For example: the probe sits near the diffuser and reads high">${esc(st.note || '')}</textarea>` }) + '</div>';
    const radios = UI.radios({
      name: 'oReason', value: st.reason || '', label: `Why does this plant differ from the ${base}?`,
      options: [
        { value: 'tuned', label: 'Tuned for this plant', sub: `Kept, and up for review on ${reviewDay()}` },
        { value: 'fornow', label: 'For now, until …', sub: `Goes back to the ${base} value on the date you pick` },
      ],
    });
    const items = [];
    if (redirects && redirects.fault) items.push(['fault', 'The sensor reads wrong', 'report a sensor fault']);
    if (redirects && redirects.scada) items.push(['scada', 'It is built differently', 'fix it in the plant graph']);
    if (redirects && redirects.lib) items.push(['lib', 'The library is wrong', 'suggest a library change']);
    const red = items.length ? `<div class="o-redir"><p>Or is it one of these? They are not kept as changes here.</p><ul>${items.map(([w, x, y]) => `<li><button type="button" data-act="obj:redirect" data-what="${w}">${esc(x)} → ${esc(y)}</button></li>`).join('')}</ul></div>` : '';
    return `<div class="o-why"${st.showWhy ? '' : ' hidden'}><h3>Why does this plant differ from the ${base}?</h3>${radios}`
      + `<div class="o-until-w"${st.reason === 'fornow' ? '' : ' hidden'}>${UI.field({ label: `Back to the ${base} on`, html: `<input type="date" class="o-until" aria-label="Back to the ${base} on" min="${esc(isoDay(now() + DAY))}" value="${esc(until)}">` })}</div>`
      + UI.field({ label: 'Note', hint: 'What you saw that makes this plant different. Required.', html: `<textarea class="o-note" rows="3" aria-label="Note" placeholder="For example: the probe sits near the diffuser and reads high">${esc(st.note || '')}</textarea>` })
      + red + '</div>';
  }
  function readWhy(el, st) {
    const r = q1(el, 'input[name="oReason"]:checked'); st.reason = r ? r.value : 'tuned';
    const n = q1(el, '.o-note'); if (n) st.note = n.value;
    const u = q1(el, '.o-until'); if (u && u.value) st.until = u.value; else if (st.reason === 'fornow' && !st.until) st.until = isoDay(now() + 30 * DAY);
  }
  function prefillWhy(st, key, ids) {
    const want = arr(ids).filter(Boolean); if (!want.length) return;
    const o = arr(safe(() => V().overrides({ plant: key }), [])).find((x) => want.includes(x.id) && (x.reason === 'tuned' || x.reason === 'fornow'));
    if (!o) return;
    st.reason = o.reason; st.note = o.note || '';
    if (o.reason === 'fornow' && o.until) st.until = isoDay(o.until);
  }
  function errHtml(text) { return text ? esc(text) : ''; }
  function schedule(fn) { if (typeof setTimeout === 'function' && typeof document !== 'undefined' && document && document.body) { clearTimeout(prevTimer); prevTimer = setTimeout(fn, 140); } else fn(); }

  /* v7: the threshold bar in the sheet: both sides of the reading on one bar, the side being changed with handles; status readings
     (ON/OFF) keep the rows of inputs */
  const barMode = (st) => st.kind !== 'status';
  function otherSide(st) {
    const od = arr(st.dirs).find((d) => d !== st.dir); if (!od) return null;
    if (st.mode === 'type') {
      const lt = safe(() => V().libType(st.code), null); const r = lt && arr(lt.readings).find((x) => x.name === st.reading); const d = r && arr(r.dirs).find((x) => x.dir === od);
      const o = {}; BANDS.forEach((b) => { const p = d && (d.perBand || {})[b]; o[b] = p ? num(p.value) : null; }); return { dir: od, bands: o };
    }
    const lim = safe(() => V().limitsOf(st.key, st.sensorId, od), null); return { dir: od, bands: lim && lim.bands ? { ...lim.bands } : {} };
  }
  function tbOpts(st) {
    const bands = lsBands(st); const cur = {}; BANDS.forEach((b) => { cur[b] = Number.isNaN(bands[b]) ? null : bands[b]; });
    const sides = { [st.dir]: cur }; if (st.other) sides[st.other.dir] = st.other.bands;
    if (!st.range) st.range = UI.tbRange(st.valid, BANDS.map((b) => cur[b]).concat(st.other ? BANDS.map((b) => st.other.bands[b]) : []), st.value);
    const tasks = {}; BANDS.forEach((b) => { if (st.does && st.does[b] === 'task') tasks[b] = (st.taskName[b] || '').trim() || 'a task'; });
    let otherLabel = ''; let editOther = '';
    if (st.other) {
      const set = BANDS.filter((b) => num(st.other.bands[b]) != null);
      otherLabel = `${st.other.dir === 'below' ? 'Low side' : 'High side'}: ${set.length ? set.map((b) => `${bandName(b)} ${fv(st.other.bands[b], st.unit, st.kind)}`).join(', ') : 'no lines'}`;
      editOther = `<button type="button" class="o-back" data-act="obj:ldir" data-dir="${st.other.dir}">${set.length ? 'Change' : 'Set'} the ${st.other.dir === 'below' ? 'low' : 'high'} side</button>`;
    }
    return { active: st.dir, sides, range: st.range, value: st.value, unit: st.unit, kind: st.kind, tasks, otherLabel, editOther };
  }
  function tbRefresh(el, st) {
    const box = q1(el, '.o-ls-bar'); if (!box) return; const o = tbOpts(st);
    const want = BANDS.filter((b) => num(o.sides[st.dir][b]) != null).map((b) => st.dir + ':' + b).sort().join(',');
    const have = box.querySelectorAll ? Array.prototype.map.call(box.querySelectorAll('.thb-h'), (x) => x.getAttribute('data-h')).sort().join(',') : '';
    const tasks = Object.keys(o.tasks).join(',');
    if (want !== have || (box.getAttribute && box.getAttribute('data-tasks')) !== tasks || !q1(box, '.thb')) { box.innerHTML = UI.tbHtml(o); if (box.setAttribute) box.setAttribute('data-tasks', tasks); }
    UI.tbSync(box, o);
  }
  /* v7/3 (card D29): each range says what it triggers. An issue starts the alert's diagnostic flow and tells people by its
     severity; a task is raised at the plant or a unit process. A range that is off shows the empty slot. */
  function trigAlert(st) { return st.mode === 'instance' ? arr(safe(() => V().alerts(st.key, { sensorId: st.sensorId }), [])).find((x) => x.dir === st.dir) || null : null; }
  function tbRow(st, b) {
    const on = st.vals[b] !== ''; const al = trigAlert(st);
    const flow = al && al.flowId ? `starts <a href="#/flows/${esc(encodeURIComponent(al.flowId))}">${esc(al.flowName || 'its diagnostic flow')}</a>` : 'no diagnostic flow yet: <a href="#/flows?kind=diagnostic">choose one in Flows</a>';
    const told = b === 'caution' ? 'shown in the app and the morning email' : esc(String(sevClock(b)).toLowerCase());
    const where = st.mode === 'instance' && W.V7STRUCT73 ? W.V7STRUCT73.filedOptions(st.key, st.eqId) : [];
    const whereSel = where.length > 1 ? `<select data-filed="${b}" aria-label="Where the task is filed">${where.map((x) => `<option value="${esc(x.id)}"${String(st.filedAt && st.filedAt[b] != null ? st.filedAt[b] : (where[0] || {}).id) === String(x.id) ? ' selected' : ''}>at ${esc(x.label)}</option>`).join('')}</select>` : '';
    let does;
    if (st.mode !== 'instance') does = `<div class="o-band-d"${on ? '' : ' hidden'}><span class="lw-does">What it triggers is set at each plant</span></div>`;
    else if (b === 'emergency') does = `<div class="o-band-d"${on ? '' : ' hidden'}><span class="o-trig-k">Triggers</span><span class="lw-does"><b>An issue</b>, on the first reading: ${flow}; calls everyone and sounds the hooter</span></div>`;
    else does = `<div class="o-band-d"${on ? '' : ' hidden'}><span class="o-trig-k">Triggers</span><select data-does="${b}" aria-label="What the ${esc(bandName(b))} range triggers"><option value="issue"${st.does[b] !== 'task' ? ' selected' : ''}>An issue</option><option value="task"${st.does[b] === 'task' ? ' selected' : ''}>A task</option></select>`
      + `<span class="lw-does o-trig-i"${st.does[b] === 'task' ? ' hidden' : ''}>${flow}; ${told}</span>`
      + `<span class="o-trig-t"${st.does[b] === 'task' ? '' : ' hidden'}><input type="text" data-taskname="${b}" value="${esc(st.taskName[b] || '')}" placeholder="Name the task, e.g. Clean the intake filters" aria-label="The task the ${esc(bandName(b))} range raises">${whereSel}</span></div>`;
    const slot = st.mode === 'instance' ? `<div class="o-band-e"${on ? ' hidden' : ''}><span class="o-trig-k">Triggers</span><span class="muted">Nothing yet. Switch this range on to choose what it triggers.</span></div>` : '';
    return `<div class="o-band o-band-t" data-row="${b}"><div class="o-band-k"><button type="button" class="o-tog" role="switch" aria-checked="${on}" aria-label="${esc(bandName(b))} line" data-act="obj:ltog" data-band="${b}"><i></i></button>${sev(b)}</div>`
      + does + slot
      + `<div class="o-band-m"><span class="o-band-chip"></span><span class="o-band-ref"></span><button type="button" class="o-back" data-act="obj:lback" data-band="${b}" hidden>${esc(st.mode === 'type' ? 'Back to the published value' : 'Back to the library value')}</button></div>`
      + '</div>';
  }
  /* a line switched on starts between its neighbours (or a step further out than the last line, or past the reading) */
  function tbDefault(st, b) {
    const o = tbOpts(st); const S = o.sides[st.dir]; const span = Math.abs(o.range[1] - o.range[0]) || 1; const up = st.dir === 'above';
    const set = BANDS.filter((x) => num(S[x]) != null);
    const prev = BANDS.slice(0, BANDS.indexOf(b)).reverse().find((x) => set.includes(x)); const next = BANDS.slice(BANDS.indexOf(b) + 1).find((x) => set.includes(x));
    let v;
    if (prev && next) v = (S[prev] + S[next]) / 2;
    else if (prev) v = S[prev] + (up ? 1 : -1) * span * 0.08;
    else if (next) v = S[next] - (up ? 1 : -1) * span * 0.08;
    else { const base = num(st.value) != null ? +st.value : (o.range[0] + o.range[1]) / 2; v = base + (up ? 1 : -1) * span * 0.1; }
    return UI.tbClampLine({ ...o, sides: { [st.dir]: { ...S, [b]: v } } }, b, v);
  }
  /* what the sheet's lines raise: tasks to take off (before the lines are saved) and to put on (after) */
  function taskChanges(st, bands) {
    const out = { removes: [], sets: [], text: '', err: null }; const words = [];
    BANDS.forEach((b) => {
      const was = st.does0[b] === 'task' ? st.taskName0[b] : null;
      const want = st.does[b] === 'task' && bands[b] != null ? String(st.taskName[b] || '').trim() : null;
      if (st.does[b] === 'task' && bands[b] != null && !want && !out.err) out.err = `Name the task the ${bandName(b)} line raises.`;
      if (was && !want) { out.removes.push(b); words.push(`The ${bandName(b)} line opens an issue again.`); }
      else if (want && (want !== was || String((st.filedAt || {})[b] || '') !== String((st.filedAt0 || {})[b] || ''))) { out.sets.push(b); const up = (st.filedAt || {})[b] ? safe(() => V().unitProcess(st.key, st.filedAt[b]), null) : null; words.push(`The ${bandName(b)} range triggers the task "${want}" at ${up ? up.tag : 'the plant'}.`); }
    });
    out.text = words.join(' '); return out;
  }

  /* ── the limits sheet ────────────────────────────────────────────────────────────────────────────────── */
  function lsFromInstance(key, sensorId, dir0) {
    const s = readingOf(key, sensorId); if (!s) return null;
    const P = plantOf(key); const e = s.eqId ? eqOf(key, s.eqId) : null;
    const dirs = arr(s.dirs).length ? arr(s.dirs).slice() : [safe(() => V().limitsOf(key, sensorId).dir, s.primaryDir || 'above')];
    const dir = dir0 && dirs.includes(dir0) ? dir0 : (s.primaryDir && dirs.includes(s.primaryDir) ? s.primaryDir : dirs[0]);
    const lim = safe(() => V().limitsOf(key, sensorId, dir), null); if (!lim) return null;
    const pb = lim.perBand || {};
    const st = {
      mode: 'instance', key, sensorId, plantName: P ? P.name : key, eqId: e ? e.id : null, eqTag: s.eqTag || (e && e.tag) || '', typeName: e ? e.typeName : '',
      name: s.name, tag: s.tag, unit: lim.unit != null ? lim.unit : s.unit, kind: s.kind === 'manual' ? 'manual' : (lim.kind || s.kind), valid: validFor(s), manual: s.kind === 'manual',
      value: s.latest ? num(s.latest.v) : null, dir, dirs, lim,
      cur: {}, base: {}, lib: {}, form: {}, perBand: pb, formWhy: lim.formWhy || null,
      free: !!lim.notInLib || (!lim.libBands && !lim.formBands),
      vals: {}, reason: null, note: '', until: null, err: null, showWhy: false,
    };
    BANDS.forEach((b) => { const p = pb[b] || {}; st.cur[b] = num(p.value); st.base[b] = num(p.baseValue); st.lib[b] = num(p.libValue); st.form[b] = num(p.formValue); st.vals[b] = st.cur[b] == null ? '' : String(st.cur[b]); });
    prefillWhy(st, key, BANDS.map((b) => (pb[b] || {}).overrideId));
    st.other = otherSide(st); st.does = {}; st.taskName = {}; st.does0 = {}; st.taskName0 = {};
    st.filedAt = {}; st.filedAt0 = {};
    arr(safe(() => V().lineWork(key, { sensorId, dir }), [])).forEach((w) => { st.does[w.band] = st.does0[w.band] = 'task'; st.taskName[w.band] = st.taskName0[w.band] = w.name; st.filedAt[w.band] = st.filedAt0[w.band] = w.filed && w.filed.kind === 'up' ? w.filed.id : ''; });
    return st;
  }
  function lsFromType(code, reading, dir0) {
    const lt = safe(() => V().libType(code), null); if (!lt) return null;
    const r = arr(lt.readings).find((x) => x.name === reading); if (!r) return null;
    const dirs = arr(r.dirs).map((d) => d.dir);
    const dir = dir0 && dirs.includes(dir0) ? dir0 : dirs[0];
    const d = arr(r.dirs).find((x) => x.dir === dir); if (!d) return null;
    const st = {
      mode: 'type', code, typeName: lt.typeName, reading: r.name, name: r.name, tag: r.tag, unit: r.unit, kind: r.kind, valid: validFor(r), manual: false,
      value: null, dir, dirs, perBand: d.perBand || {}, cur: {}, base: {}, lib: {}, form: {}, alertName: d.alertName,
      free: false, vals: {}, err: null, showWhy: false, version: lt.version,
    };
    BANDS.forEach((b) => { const p = st.perBand[b] || {}; st.cur[b] = num(p.value); st.base[b] = num(p.libValue); st.lib[b] = st.base[b]; st.vals[b] = st.cur[b] == null ? '' : String(st.cur[b]); });
    st.other = otherSide(st); st.does = {}; st.taskName = {}; st.does0 = {}; st.taskName0 = {};
    return st;
  }
  function lsBands(st) {
    const out = {};
    BANDS.forEach((b) => { const raw = st.vals[b]; out[b] = raw === '' || raw == null ? null : (isFinite(+raw) ? +raw : NaN); });
    return out;
  }
  function lsValidate(st, bands) {
    for (const b of BANDS) {
      const v = bands[b]; if (v == null) continue;
      if (Number.isNaN(v)) return `${bandName(b)} must be a number.`;
      if (st.valid && st.kind !== 'status' && (v < st.valid[0] || v > st.valid[1])) return `${bandName(b)} ${fv(v, st.unit, st.kind)} is outside what ${st.name} can read (${fv(st.valid[0], st.unit, st.kind)} to ${fv(st.valid[1], st.unit, st.kind)}).`;
    }
    const set = BANDS.filter((b) => bands[b] != null);
    for (let i = 1; i < set.length; i++) {
      const x = bands[set[i - 1]]; const y = bands[set[i]];
      if (st.dir === 'below' ? !(y < x) : !(y > x)) return `${bandName(set[i])} must be ${st.dir === 'below' ? 'lower' : 'higher'} than ${bandName(set[i - 1])}: each band goes further ${st.dir === 'below' ? 'down' : 'up'}.`;
    }
    return null;
  }
  function lsNeedsWhy(st, bands) {
    if (st.mode !== 'instance' || st.free) return false;
    return BANDS.some((b) => !same(bands[b], st.cur[b]) && !same(bands[b], st.base[b]));
  }
  function baseIsForm(st, b) { return st.form[b] != null && same(st.base[b], st.form[b]) && !same(st.base[b], st.lib[b]); }
  function lsChip(st, b, t) {
    if (st.mode === 'type') return same(t, st.base[b]) ? (t == null ? '' : chipNamed('lib')) : draftChip();
    if (same(t, st.cur[b])) { const p = st.perBand[b] || {}; return t == null && !(p.chip === 'changed' || p.chip === 'libchanged') ? '' : sourceChip(p); }
    if (st.free) return chipNamed('changed');
    if (same(t, st.base[b])) return baseIsForm(st, b) ? chipNamed('form', st.formWhy) : (t == null ? '' : chipNamed('lib'));
    return chipNamed('changed');
  }
  function lsRef(st, b, t) {
    const B = st.base[b];
    if (st.mode === 'type') return same(t, B) ? '' : `Library now ${B == null ? 'none' : fv(B, st.unit, st.kind)}`;
    if (st.free || same(t, B)) return '';
    return `${baseIsForm(st, b) ? 'plant graph' : 'Library'} ${B == null ? 'none' : fv(B, st.unit, st.kind)}`;
  }
  function lsInput(st, b) {
    const label = `${bandName(b)} limit`;
    if (st.kind === 'status') {
      const on = st.dir === 'below' ? '0' : '1';
      return `<select data-band="${b}" aria-label="${esc(label)}"><option value=""${st.vals[b] === '' ? ' selected' : ''}>Not set</option><option value="${on}"${st.vals[b] !== '' ? ' selected' : ''}>when ${on === '1' ? 'ON' : 'OFF'}</option></select>`;
    }
    return `<input type="number" step="any" inputmode="decimal" data-band="${b}" value="${esc(st.vals[b])}" placeholder="Not set" aria-label="${esc(label)}">${st.unit ? `<span class="o-unit">${esc(st.unit)}</span>` : ''}`;
  }
  function lsBody(st) {
    const fires = st.kind === 'status' ? `Fires when ${st.name} is ${st.dir === 'below' ? 'OFF' : 'ON'}.` : `Fires when ${st.name} ${st.dir === 'below' ? 'falls below' : 'rises above'} a limit.`;
    const sw = (st.dirs.length > 1 ? UI.filters(st.dirs.map((d) => ({ label: dirHead(d), act: 'obj:ldir', data: { dir: d }, on: d === st.dir }))) : '') + `<p class="o-sh-k">${esc(fires)}</p>`;
    const intro = st.mode === 'type'
      ? note(`Library values for ${st.typeName}. Saving puts them in the draft of version ${st.version + 1}; no plant changes until the draft is published.`, 'quiet')
      : st.free ? note('The library has no limits for this reading, so these are this plant\'s own.', 'quiet') : '';
    if (barMode(st)) return `${sw}${intro}<div class="o-ls-bar">${UI.tbHtml(tbOpts(st))}</div><div class="o-bands o-bands-t">${BANDS.map((b) => tbRow(st, b)).join('')}</div>`
      + (st.mode === 'type' ? '<p class="o-hint">What a line does at a plant, open an issue or raise a task there, is set at each plant.</p>' : '')
      + `${st.mode === 'type' ? `<div class="o-safety" hidden>${note('Changing Emergency is a safety change: it needs a reason, and it reaches every plant that follows the library. A plant that changed the value keeps its own.', 'warn')}</div>` : ''}<div class="o-prev" aria-live="polite"></div><p class="field-e o-ls-err" role="alert"></p>${st.mode === 'instance' && !st.free ? whyHtml(st, { fault: !st.manual, scada: true, lib: true }) : ''}`;
    const rows = BANDS.map((b) => `<div class="o-band" data-row="${b}"><div class="o-band-k">${sev(b)}<small>${st.kind === 'status' ? 'fires' : esc(dirWord(st.dir))}</small></div>`
      + `<div class="o-band-v">${lsInput(st, b)}</div>`
      + `<div class="o-band-m"><span class="o-band-chip"></span><span class="o-band-ref"></span><button type="button" class="o-back" data-act="obj:lback" data-band="${b}" hidden>${esc(st.mode === 'type' ? 'Back to the published value' : 'Back to the library value')}</button></div>`
      + (b === 'emergency' ? '<p class="o-band-h">Emergency fires on the first reading.</p>' : '') + '</div>').join('');
    const safety = st.mode === 'type' ? `<div class="o-safety" hidden>${note('Changing Emergency is a safety change: it needs a reason, and it reaches every plant that follows the library. A plant that changed the value keeps its own.', 'warn')}</div>` : '';
    const why = st.mode === 'instance' && !st.free ? whyHtml(st, { fault: !st.manual, scada: true, lib: true }) : '';
    return `${sw}${intro}<div class="o-ls-bar"></div><div class="o-bands">${rows}</div>${safety}<div class="o-prev" aria-live="polite"></div><p class="field-e o-ls-err" role="alert"></p>${why}`;
  }
  function lsFoot(st) {
    return btn('Cancel', { act: 'ui:close', data: { what: 'sheet' }, kind: 'ghost' }) + btn(st.mode === 'type' ? 'Save to the draft' : 'Save limits', { act: 'obj:lsave', kind: 'primary' });
  }
  function lsTitle(st) { return `Limits · ${st.name}`; }
  function lsSub(st) { return st.mode === 'type' ? `${st.typeName} · library` : `${st.tag ? st.tag + ' on ' : 'On '}${st.eqTag || 'the plant'} · ${st.plantName}`; }
  function openLimits(o) {
    o = o || {};
    const st = o.mode === 'type' ? lsFromType(o.code, o.reading, o.dir) : lsFromInstance(o.plant || o.key, o.sensorId || o.sensor, o.dir);
    if (!st) { UI.toast('That reading could not be found.'); return null; }
    LS = st; VS = null;
    return UI.openSheet({ title: lsTitle(st), sub: lsSub(st), body: lsBody(st), foot: lsFoot(st), onBind: lsBind, onClose: () => { LS = null; } });
  }
  function lsBind(el) {
    if (!el) return;
    if (!el._oBound && typeof el.addEventListener === 'function') {
      const h = (ev) => {
        const t = ev.target; if (!LS || !t || !t.getAttribute) return; const b = t.getAttribute('data-band'); if (b && t.tagName !== 'BUTTON') LS.vals[b] = t.value;
        const d = t.getAttribute('data-does'); if (d) LS.does[d] = t.value; const tn = t.getAttribute('data-taskname'); if (tn) LS.taskName[tn] = t.value;
        const fd = t.getAttribute('data-filed'); if (fd) { LS.filedAt = LS.filedAt || {}; LS.filedAt[fd] = t.value; }
        readWhy(el, LS); lsUpdate(el);
      };
      el.addEventListener('input', h); el.addEventListener('change', h); el._oBound = true;
    }
    const bar = q1(el, '.o-ls-bar');
    if (bar && LS && barMode(LS) && UI.tbBind) UI.tbBind(bar, {
      get: () => tbOpts(LS),
      onValue: (b, v) => { if (!LS) return; LS.vals[b] = String(v); const inp = q1(bar, `input[data-band="${b}"]`); if (inp) inp.value = String(v); lsUpdate(el); },
      onRange: (lo, hi) => { if (!LS) return; LS.range = [lo, hi]; lsUpdate(el); },
    });
    lsUpdate(el);
  }
  function lsPreviewText(st, bands, err) {
    if (st.manual) return { html: 'Manual and lab readings have no samples, so there is nothing to replay.', tone: '' };
    if (err) return { html: 'Fix the limits above to see the replay.', tone: '' };
    if (st.mode === 'type') return typePreview(st, bands);
    { const P0 = plantOf(st.key); if (P0 && P0.state !== 'live') return { html: 'A new plant needs no readings to set its limits. Once the plant is Live, a change here shows the last 7 days replayed with the new limits.', tone: '' }; }
    const r = safe(() => V().previewLimits(st.key, st.sensorId, st.dir, bands), null);
    if (!r) return { html: 'No replay for this reading.', tone: '' };
    const changed = BANDS.some((b) => !same(bands[b], st.cur[b]));
    const head = changed
      ? `Last 7 days with these limits: would have fired <b>${r.count}</b> ${r.count === 1 ? 'time' : 'times'} (now ${r.countNow}).`
      : `Last 7 days with these limits: would have fired <b>${r.countNow}</b> ${r.countNow === 1 ? 'time' : 'times'}.`;
    const tail = r.alertId ? '' : ' No alert reads it yet: this is what one would do.';
    return { html: head + esc(tail), tone: !changed || r.count === r.countNow ? '' : r.count < r.countNow ? 'ok' : 'warn' };
  }
  function typePreview(st, bands) {
    if (!st.sites) st.sites = typeSites(st.typeName, st.reading);
    if (!st.sites.length) return { html: 'No plant has this reading yet, so there is nothing to replay.', tone: '' };
    let n = 0; let m = 0; let follow = 0; const ps = new Set();
    const safety = !same(bands.emergency, st.base.emergency);   /* v7: an Emergency change is a safety change: it lands everywhere */
    st.sites.forEach((x) => {
      const lim = safe(() => V().limitsOf(x.key, x.s.id, st.dir), null); if (!lim) return;
      const nb = {}; let f = false;
      BANDS.forEach((b) => { const p = (lim.perBand || {})[b]; if (followsLib(p) || (safety && b === 'emergency')) { nb[b] = bands[b]; if (!same(bands[b], lim.bands[b])) f = true; } else nb[b] = lim.bands[b]; });
      const r = safe(() => V().previewLimits(x.key, x.s.id, st.dir, nb), null); if (!r) return;
      n += r.count; m += r.countNow; ps.add(x.plant); if (f) follow++;
    });
    const changed = BANDS.some((b) => !same(bands[b], st.base[b]));
    const head = changed
      ? `Last 7 days at ${plural(ps.size, 'plant')} (${plural(st.sites.length, 'reading')}): would have fired <b>${n}</b> ${n === 1 ? 'time' : 'times'} (now ${m}).`
      : `Last 7 days at ${plural(ps.size, 'plant')} (${plural(st.sites.length, 'reading')}): would have fired <b>${m}</b> ${m === 1 ? 'time' : 'times'}.`;
    return { html: head + (safety ? ' A safety change reaches every plant that follows the library; a plant that changed the value keeps its own.' : ' Plants that changed a value keep theirs.'), tone: !changed || n === m ? '' : n < m ? 'ok' : 'warn' };
  }
  function lsState(st) {
    const bands = lsBands(st); const err = lsValidate(st, bands);
    const view = {};
    BANDS.forEach((b) => { const t = Number.isNaN(bands[b]) ? null : bands[b]; view[b] = { chip: lsChip(st, b, t), ref: lsRef(st, b, t), back: st.mode === 'type' ? !same(t, st.base[b]) : (!st.free && !same(t, st.base[b])) }; });
    const needsWhy = lsNeedsWhy(st, bands);
    const safetyChange = st.mode === 'type' && !same(bands.emergency, st.base.emergency);
    return { bands, err, view, needsWhy, safetyChange };
  }
  function lsUpdate(el) {
    const st = LS; if (!st || !el) return;
    const v = lsState(st);
    if (barMode(st)) tbRefresh(el, st);
    else if (st.kind !== 'status' && !st.manual) {
      const ok = {}; BANDS.forEach((b) => { ok[b] = v.err || Number.isNaN(v.bands[b]) ? null : v.bands[b]; });
      setHtml(q1(el, '.o-ls-bar'), v.err ? '' : bandBar({ dir: st.dir, bands: ok, value: st.value, valid: st.valid, unit: st.unit }));
    }
    BANDS.forEach((b) => {
      const row = q1(el, `.o-band[data-row="${b}"]`); if (!row) return;
      setHtml(q1(row, '.o-band-chip'), v.view[b].chip);
      setHtml(q1(row, '.o-band-ref'), esc(v.view[b].ref));
      const tog = q1(row, '.o-tog'); if (tog) tog.setAttribute('aria-checked', String(st.vals[b] !== ''));
      const does = q1(row, '.o-band-d'); if (does) { setHidden(does, st.vals[b] === ''); setHidden(q1(row, '.o-trig-t'), st.does[b] !== 'task'); setHidden(q1(row, '.o-trig-i'), st.does[b] === 'task'); }
      setHidden(q1(row, '.o-band-e'), st.vals[b] !== '');
      const back = q1(row, '.o-back'); if (back) { setHidden(back, !v.view[b].back); if (st.mode === 'instance') back.textContent = baseIsForm(st, b) ? 'Back to the plant graph value' : 'Back to the library value'; }
    });
    st.showWhy = st.showWhy || v.needsWhy;
    setHidden(q1(el, '.o-why'), !v.needsWhy && !st.forceWhy);
    setHidden(q1(el, '.o-until-w'), st.reason !== 'fornow');
    setHidden(q1(el, '.o-safety'), !v.safetyChange);
    setHtml(q1(el, '.o-ls-err'), errHtml(st.err || v.err));
    st.err = null;
    const box = q1(el, '.o-prev');
    if (box) {
      schedule(() => {
        if (LS !== st) return;
        const p = lsPreviewText(st, v.bands, v.err);
        box.className = 'o-prev' + (p.tone ? ' tone-' + p.tone : '');
        box.innerHTML = `<span>${p.html}</span>${st.manual ? '' : sampleTag()}`;
      });
    }
  }
  function changesText(st, bands) {
    return BANDS.filter((b) => !same(bands[b], st.cur[b])).map((b) => {
      const from = st.cur[b]; const to = bands[b];
      if (from == null) return `${bandName(b)} set at ${fv(to, st.unit, st.kind)}`;
      if (to == null) return `${bandName(b)} removed`;
      return `${bandName(b)} ${fv(from, st.unit, st.kind)} → ${fv(to, st.unit, st.kind)}`;
    }).join(', ');
  }
  function saveLimits() {
    const st = LS; if (!st) return false;
    const el = UI.sheetEl(); if (el) readWhy(el, st);
    const bands = lsBands(st); const err = lsValidate(st, bands);
    if (err) { st.err = err; if (el) lsUpdate(el); return false; }
    const what = changesText(st, bands); const tk = st.mode === 'instance' ? taskChanges(st, bands) : { removes: [], sets: [], text: '', err: null };
    if (tk.err) { st.err = tk.err; if (el) lsUpdate(el); return false; }
    if (!what && !tk.text) { UI.closeSheet(); UI.toast('Nothing changed.'); return false; }
    if (st.mode === 'type') {
      const r = safe(() => V().editLib(st.code, { reading: st.reading, dir: st.dir, bands }), null);
      if (!r || !r.ok) { st.err = (r && r.error) || 'That did not save.'; if (el) lsUpdate(el); return false; }
      UI.closeSheet(); LS = null;
      UI.toast(`Saved to the draft of ${st.typeName}: ${st.reading} ${dirWord(st.dir)}, ${what}. Check Where it lands, then publish.`);
      return undefined;
    }
    const opts = lsNeedsWhy(st, bands) ? { reason: st.reason, note: st.note, until: st.reason === 'fornow' ? st.until : undefined } : {};
    /* v7: a line's task comes off before its line can go; a new task goes on once its line is saved */
    tk.removes.forEach((b) => safe(() => V().setLineWork(st.key, st.sensorId, st.dir, b, { name: null }), null));
    const r = what ? safe(() => V().setLimits(st.key, st.sensorId, st.dir, bands, opts), null) : { ok: true };
    if (!r || !r.ok) {
      tk.removes.forEach((b) => safe(() => V().setLineWork(st.key, st.sensorId, st.dir, b, { name: st.taskName0[b] }), null));
      st.err = (r && r.error) || 'That did not save.'; if (r && r.needsReason) st.forceWhy = true; if (el) lsUpdate(el); return false;
    }
    const bad = tk.sets.map((b) => ({ b, r: safe(() => V().setLineWork(st.key, st.sensorId, st.dir, b, { name: String(st.taskName[b]).trim(), filedAt: (st.filedAt || {})[b] || null }), null) })).find((x) => !x.r || !x.r.ok);
    UI.closeSheet(); LS = null;
    const why = opts.reason === 'tuned' ? ' Tuned for this plant.' : opts.reason === 'fornow' ? ` For now, until ${fmtDay(Date.parse(st.until + 'T06:00:00+05:30'))}.` : '';
    const tail = (tk.text ? ' ' + tk.text : '') + (bad ? ` ${bad.r ? bad.r.error : 'A task did not save.'}` : '');
    UI.toast(what ? `Limits saved on ${st.name}${st.tag ? ` (${st.tag})` : ''}: ${what}.${why}${tail}` : tail.trim());
    return undefined;
  }

  /* ── small value sheets: timing, cadence, tier ───────────────────────────────────────────────────────── */
  function vsOpen(st) {
    VS = st; LS = null;
    return UI.openSheet({ title: st.title, sub: st.sub, body: vsBody(st), foot: btn('Cancel', { act: 'ui:close', data: { what: 'sheet' }, kind: 'ghost' }) + btn(st.saveLabel, { act: st.saveAct, kind: 'primary' }), onBind: vsBind, onClose: () => { VS = null; } });
  }
  function vsRow(st, f) {
    let input = '';
    if (f.type === 'min') input = `<div class="o-row2"><input type="number" min="0" max="1440" step="1" data-f="${f.id}" value="${esc(st.vals[f.id])}" aria-label="${esc(f.label)}"${f.disabled ? ' disabled' : ''}><span class="o-unit">min</span></div>`;
    else if (f.type === 'every') input = `<div class="o-row2"><span>Every</span><input type="number" min="1" step="1" data-f="n" value="${esc(st.vals.n)}" aria-label="How many"><select data-f="unit" aria-label="Unit">${UNITS.map((u) => `<option value="${u}"${st.vals.unit === u ? ' selected' : ''}>${u}s</option>`).join('')}</select></div>`;
    else if (f.type === 'tier') input = `<select data-f="tier" aria-label="Criticality">${['A', 'B', 'C'].map((t) => `<option value="${t}"${st.vals.tier === t ? ' selected' : ''}>${TIER[t]}</option>`).join('')}</select>`;
    else if (f.type === 'runhours') input = `<div class="o-row2"><span>${esc(f.prefix || 'Every')}</span><input type="number" min="1" step="1" data-f="runhours" value="${esc(st.vals.runhours)}" aria-label="Run-hours"><span class="o-unit">run-hours</span></div>`;
    return `<div class="o-vrow" data-row="${f.id}"><div class="o-vrow-l">${esc(f.label)}</div><div>${input}</div><div class="o-vrow-m"><span class="o-band-chip"></span><span class="o-band-ref"></span><button type="button" class="o-back" data-act="obj:vback" data-f="${f.id}" hidden>${esc(st.mode === 'type' ? 'Back to the published value' : vsFromForm(st, f.id) ? 'Back to the plant graph value' : 'Back to the library value')}</button></div>${f.hint ? `<p class="o-band-h">${esc(f.hint)}</p>` : ''}</div>`;
  }
  function vsBody(st) {
    const why = st.mode === 'instance' ? (st.kind === 'tier'
      ? `<div class="o-why"${st.showWhy ? '' : ' hidden'}><h3>Why does this plant differ from the library?</h3><p class="o-hint">Kept as Tuned for this plant, up for review on ${esc(reviewDay())}.</p>${UI.field({ label: 'Note', hint: 'Required.', html: `<textarea class="o-note" rows="3" aria-label="Note">${esc(st.note || '')}</textarea>` })}<div class="o-redir"><ul><li><button type="button" data-act="obj:redirect" data-what="lib">The library is wrong → suggest a library change</button></li></ul></div></div>`
      : whyHtml(st, { scada: st.kind === 'cadence', lib: true })) : '';
    return `${st.intro ? note(st.intro, 'quiet') : ''}<div class="o-bands">${st.fields.map((f) => vsRow(st, f)).join('')}</div>${st.extra || ''}<div class="o-prev" aria-live="polite"${st.preview ? '' : ' hidden'}></div><p class="field-e o-ls-err" role="alert"></p>${why}`;
  }
  function vsValue(st, id) {
    if (st.kind === 'cadence' && id === 'runhours') { const raw = st.vals.runhours; return raw === '' || raw == null || !isFinite(+raw) ? null : Math.round(+raw); }
    if (st.kind === 'cadence') return { n: Math.round(+st.vals.n), unit: st.vals.unit };
    if (st.kind === 'tier') return st.vals.tier;
    const raw = st.vals[id]; return raw === '' || raw == null || !isFinite(+raw) ? null : Math.round(+raw);
  }
  /* v7: the cadence of a task the plant graph proposes is measured against the form (its run-hours part against the library) */
  function vsFromForm(st, id) { return st.mode === 'instance' && st.kind === 'cadence' && st.baseFrom === 'form' && id !== 'runhours'; }
  function vsSame(st, x, y, id) { return id === 'runhours' ? same(x, y) : st.kind === 'cadence' ? sameEvery(x, y) : st.kind === 'tier' ? x === y : same(x, y); }
  function vsFmt(st, x, id) { return id === 'runhours' ? (x == null ? 'none' : `every ${x} run-hours`) : st.kind === 'cadence' ? everyText(x) : st.kind === 'tier' ? (x ? (TIER[x] || x) : 'none') : (x == null ? 'none' : `${x} min`); }
  function vsBind(el) {
    if (!el) return;
    if (!el._oBound && typeof el.addEventListener === 'function') {
      const h = (ev) => { const t = ev.target; if (!VS || !t) return; const f = t.getAttribute && t.getAttribute('data-f'); if (f && t.tagName !== 'BUTTON') VS.vals[f] = t.value; readWhy(el, VS); vsUpdate(el); };
      el.addEventListener('input', h); el.addEventListener('change', h); el._oBound = true;
    }
    vsUpdate(el);
  }
  function vsState(st) {
    const out = { rows: {}, needsWhy: false, changed: false, err: null };
    st.fields.forEach((f) => {
      const v = vsValue(st, f.id); const cur = st.cur[f.id]; const lib = st.lib[f.id];
      const changed = !vsSame(st, v, cur, f.id); if (changed) out.changed = true;
      if (st.kind !== 'cadence' && st.kind !== 'tier' && v == null) out.err = `${f.label}: give minutes between 0 and 1440.`;
      if (st.kind === 'cadence' && f.id === 'runhours' && !(v >= 1)) out.err = 'Give the run-hours: a whole number, 1 or more.';
      if (st.kind === 'cadence' && f.id !== 'runhours' && (!(v.n >= 1) || !UNITS.includes(v.unit))) out.err = 'Give how often: a number and a unit.';
      const toLib = vsSame(st, v, lib, f.id);
      if (st.mode === 'instance' && changed && !toLib && !st.free && !(f.id === 'runhours' && lib == null)) out.needsWhy = true;
      const fromForm = vsFromForm(st, f.id);
      const chipH = st.mode === 'type' ? (toLib ? chipNamed('lib') : draftChip()) : (!changed ? (st.chips[f.id] ? sourceChip(st.chips[f.id]) : '') : toLib ? chipNamed(fromForm ? 'form' : 'lib') : chipNamed('changed'));
      const ref = toLib || lib == null ? '' : `${st.mode === 'type' ? 'Library now' : fromForm ? 'plant graph' : 'Library'} ${vsFmt(st, lib, f.id)}`;
      out.rows[f.id] = { chip: chipH, ref, back: lib != null && !toLib };
    });
    return out;
  }
  function vsUpdate(el) {
    const st = VS; if (!st || !el) return;
    const v = vsState(st);
    st.fields.forEach((f) => {
      const row = q1(el, `.o-vrow[data-row="${f.id}"]`); if (!row) return;
      setHtml(q1(row, '.o-band-chip'), v.rows[f.id].chip); setHtml(q1(row, '.o-band-ref'), esc(v.rows[f.id].ref)); setHidden(q1(row, '.o-back'), !v.rows[f.id].back);
    });
    setHidden(q1(el, '.o-why'), !v.needsWhy && !st.forceWhy);
    setHidden(q1(el, '.o-until-w'), st.reason !== 'fornow');
    setHtml(q1(el, '.o-ls-err'), errHtml(st.err || v.err)); st.err = null;
    const box = q1(el, '.o-prev');
    if (box && st.preview) schedule(() => { if (VS !== st) return; const p = st.preview(st, v); box.className = 'o-prev' + (p.tone ? ' tone-' + p.tone : ''); box.innerHTML = `<span>${p.html}</span>${sampleTag()}`; });
  }
  function timingPreview(st) {
    const hold = vsValue(st, 'hold'); const clear = vsValue(st, 'clear');
    if (hold == null || clear == null) return { html: 'Give both times to see the replay.', tone: '' };
    const t1 = now(); const t0 = t1 - 7 * DAY;
    if (st.mode === 'type') {
      let n = 0; let m = 0; let k = 0;
      arr(safe(() => V().plants(), [])).forEach((p) => {
        arr(safe(() => V().alerts(p.key, {}), [])).filter((al) => String(al.name).split(' — ')[0] === st.alertName && (eqOf(p.key, al.eqId) || {}).typeName === st.typeName).forEach((al) => {
          const h2 = al.hold && al.hold.chip === 'lib' ? hold : undefined; const c2 = al.clear && al.clear.chip === 'lib' ? clear : undefined;
          const a1 = safe(() => V().replay(p.key, al.id, { from: t0, to: t1, hold: h2, clear: c2 }), null); const a0 = safe(() => V().replay(p.key, al.id, { from: t0, to: t1 }), null);
          if (a1 && a0) { n += a1.count; m += a0.count; k++; }
        });
      });
      if (!k) return { html: 'No plant runs this alert yet, so there is nothing to replay.', tone: '' };
      return { html: `Last 7 days at the plants (${plural(k, 'alert')}): would have fired <b>${n}</b> ${n === 1 ? 'time' : 'times'} (now ${m}). Plants that changed a time keep theirs.`, tone: n === m ? '' : n < m ? 'ok' : 'warn' };
    }
    const r1 = safe(() => V().replay(st.key, st.alertId, { from: t0, to: t1, hold, clear }), null);
    const r0 = safe(() => V().replay(st.key, st.alertId, { from: t0, to: t1 }), null);
    if (!r1 || !r0) return { html: 'No replay for this alert.', tone: '' };
    return { html: `Last 7 days with these times: would have fired <b>${r1.count}</b> ${r1.count === 1 ? 'time' : 'times'} (now ${r0.count}).`, tone: r1.count === r0.count ? '' : r1.count < r0.count ? 'ok' : 'warn' };
  }
  function openTiming(o) {
    o = o || {};
    if (o.mode === 'type') {
      const lt = safe(() => V().libType(o.code), null); const x = lt && arr(lt.alerts).find((y) => y.name === (o.alert || o.name));
      if (!x) { UI.toast('That alert could not be found in the library.'); return null; }
      const dt = lt.draft && lt.draft.alerts ? lt.draft.alerts[x.name] || {} : {};
      const cur = { hold: dt.hold != null ? dt.hold : x.hold, clear: dt.clear != null ? dt.clear : x.clear };
      const emOnly = x.bands && BANDS.every((b) => b === 'emergency' || num(x.bands[b]) == null);
      return vsOpen({
        kind: 'timing', mode: 'type', code: lt.code, typeName: lt.typeName, alertName: x.name, title: `Times · ${x.name}`, sub: `${lt.typeName} · library`,
        intro: `Library values. Saving puts them in the draft of version ${lt.version + 1}; no plant changes until the draft is published.`,
        fields: [{ id: 'hold', type: 'min', label: 'Must hold for', hint: emOnly ? 'This alert has only an Emergency band, which fires on the first reading.' : 'Emergency fires on the first reading, whatever this says.' }, { id: 'clear', type: 'min', label: 'Must clear for' }],
        cur, lib: { hold: x.hold, clear: x.clear }, chips: {}, vals: { hold: String(cur.hold), clear: String(cur.clear) }, saveLabel: 'Save to the draft', saveAct: 'obj:tsave', preview: timingPreview,
      });
    }
    const key = o.plant || o.key; const al = safe(() => V().alert(key, o.alertId || o.alert), null);
    if (!al) { UI.toast('That alert could not be found.'); return null; }
    const P = plantOf(key);
    const emOnly = al.bands && BANDS.every((b) => b === 'emergency' || num(al.bands[b]) == null);
    const st = {
      kind: 'timing', mode: 'instance', key, alertId: al.id, name: al.name, typeName: (eqOf(key, al.eqId) || {}).typeName || '', plantName: P ? P.name : key,
      title: `Times · ${al.name}`, sub: `${al.eqTag ? al.eqTag + ' · ' : ''}${P ? P.name : ''}`,
      fields: [{ id: 'hold', type: 'min', label: 'Must hold for', hint: emOnly ? 'This alert has only an Emergency band, which fires on the first reading.' : 'Emergency fires on the first reading, whatever this says.' }, { id: 'clear', type: 'min', label: 'Must clear for' }],
      cur: { hold: al.hold ? al.hold.value : null, clear: al.clear ? al.clear.value : null }, lib: { hold: al.hold ? al.hold.libValue : null, clear: al.clear ? al.clear.libValue : null },
      chips: { hold: al.hold, clear: al.clear }, vals: { hold: String(al.hold ? al.hold.value : ''), clear: String(al.clear ? al.clear.value : '') },
      free: false, reason: null, note: '', until: null, saveLabel: 'Save times', saveAct: 'obj:tsave', preview: timingPreview,
      extra: al.openIssueId ? note('An issue from this alert is open. It keeps the times it opened under; a change here applies to the next one.', 'info') : '',
    };
    prefillWhy(st, key, [al.hold && al.hold.overrideId, al.clear && al.clear.overrideId]);
    return vsOpen(st);
  }
  function saveTiming() {
    const st = VS; if (!st) return false; const el = UI.sheetEl(); if (el) readWhy(el, st);
    const v = vsState(st); if (v.err) { st.err = v.err; if (el) vsUpdate(el); return false; }
    if (!v.changed) { UI.closeSheet(); UI.toast('Nothing changed.'); return false; }
    const hold = vsValue(st, 'hold'); const clear = vsValue(st, 'clear');
    const what = ['hold', 'clear'].filter((f) => !same(vsValue(st, f), st.cur[f])).map((f) => `must ${f} for ${st.cur[f]} → ${vsValue(st, f)} min`).join(', ');
    let r;
    if (st.mode === 'type') r = safe(() => V().editLib(st.code, { alert: st.alertName, hold, clear }), null);
    else r = safe(() => V().setAlertTiming(st.key, st.alertId, { hold, clear }, v.needsWhy ? { reason: st.reason, note: st.note, until: st.reason === 'fornow' ? st.until : undefined } : {}), null);
    if (!r || !r.ok) { st.err = (r && r.error) || 'That did not save.'; if (r && r.needsReason) st.forceWhy = true; if (el) vsUpdate(el); return false; }
    UI.closeSheet(); VS = null;
    UI.toast(st.mode === 'type' ? `Saved to the draft of ${st.typeName}: ${st.alertName}, ${what}. Check Where it lands, then publish.` : `${st.name}: ${what}.`);
    return undefined;
  }
  function openCadence(o) {
    o = o || {};
    if (o.mode === 'type') {
      const lt = safe(() => V().libType(o.code), null); const x = lt && arr(lt.schedules).find((y) => y.name === o.schedule);
      if (!x || !x.every) { UI.toast('That task has no interval to change.'); return null; }
      const cur = x.draftEvery || (lt.draft && lt.draft.schedules ? lt.draft.schedules[x.name] : null) || x.every;
      return vsOpen({
        kind: 'cadence', mode: 'type', code: lt.code, typeName: lt.typeName, schedule: x.name, title: `How often · ${x.name}`, sub: `${lt.typeName} · library`,
        intro: `Library value. Saving puts it in the draft; Where it lands then shows which tasks would fall due at once.${/run-hours/.test(x.everyText || '') ? ' The run-hours part stays as it is.' : ''}`,
        fields: [{ id: 'every', type: 'every', label: 'How often' }], cur: { every: cur }, lib: { every: x.every }, chips: {}, vals: { n: String(cur.n), unit: cur.unit },
        saveLabel: 'Save to the draft', saveAct: 'obj:csave',
      });
    }
    const key = o.plant || o.key; const t = safe(() => V().task(key, o.taskId || o.task), null);
    if (!t || !t.every) { UI.toast('That task has no interval to change.'); return null; }
    const P = plantOf(key); const src = t.source || {};
    const shared = t.eqIds && t.eqIds.length > 1 ? `Shared task: ${t.line}. The change applies to every one of them.` : '';
    /* v7: the one "how often" editor (the task page opens it too). Work that runs on its hour meter edits its run-hours here as well:
       "every 150 run-hours" alone, or "every 6 months" plus "or every 500 run-hours" */
    const rh = t.runHours || null; const meterOnly = !!rh && t.basis === 'meter'; const either = !!rh && t.basis === 'either';
    const fields = meterOnly ? [{ id: 'runhours', type: 'runhours', label: 'How often', prefix: 'Every' }]
      : either ? [{ id: 'every', type: 'every', label: 'How often' }, { id: 'runhours', type: 'runhours', label: 'Or by the hour meter', prefix: 'or every', hint: 'Whichever comes first.' }]
      : [{ id: 'every', type: 'every', label: 'How often' }];
    const rhLib = meterOnly ? (src.libValue && src.libValue.n) || null : rh ? rh.libValue : null;
    const st = {
      kind: 'cadence', mode: 'instance', key, taskId: t.id, name: t.name, typeName: t.typeName || '', plantName: P ? P.name : key,
      title: `How often · ${t.name}`, sub: `${t.line || ''}${P ? ' · ' + P.name : ''}`,
      intro: [shared, rh ? 'Run-hours are counted by the hour meter, from the last service or from go live.' : ''].filter(Boolean).join(' '),
      /* v7: baseFrom 'form' (a task the plant graph proposes): the sheet calls its base the plant graph, never the library */
      baseFrom: src.baseFrom === 'form' ? 'form' : 'lib',
      fields, cur: { every: t.every, runhours: rh ? rh.value : null }, lib: { every: src.libValue || null, runhours: rhLib }, chips: { every: src, runhours: meterOnly ? src : rh },
      vals: { n: String(t.every.n), unit: t.every.unit, runhours: rh ? String(rh.value) : '' }, free: src.libValue == null && !(rh && rh.libValue != null), reason: null, note: '', until: null, saveLabel: 'Save', saveAct: 'obj:csave',
    };
    prefillWhy(st, key, [src.overrideId, rh && rh.overrideId]);
    return vsOpen(st);
  }
  function saveCadence() {
    const st = VS; if (!st) return false; const el = UI.sheetEl(); if (el) readWhy(el, st);
    const v = vsState(st); if (v.err) { st.err = v.err; if (el) vsUpdate(el); return false; }
    if (!v.changed) { UI.closeSheet(); UI.toast('Nothing changed.'); return false; }
    const hasEv = st.fields.some((f) => f.id === 'every'); const hasRh = st.fields.some((f) => f.id === 'runhours');
    const ev = hasEv ? vsValue(st, 'every') : null; const rh = hasRh ? vsValue(st, 'runhours') : null;
    const what = [hasEv && !sameEvery(ev, st.cur.every) ? `${everyText(st.cur.every)} → ${everyText(ev)}` : '', hasRh && !same(rh, st.cur.runhours) ? `every ${st.cur.runhours} → ${rh} run-hours` : ''].filter(Boolean).join(', ');
    const arg = Object.assign({}, hasEv && !sameEvery(ev, st.cur.every) ? ev : {}, hasRh && !same(rh, st.cur.runhours) ? { runHours: rh } : {});
    const r = st.mode === 'type'
      ? safe(() => V().editLib(st.code, { schedule: st.schedule, every: ev }), null)
      : safe(() => V().setCadence(st.key, st.taskId, arg, v.needsWhy ? { reason: st.reason, note: st.note, until: st.reason === 'fornow' ? st.until : undefined } : {}), null);
    if (!r || !r.ok) { st.err = (r && r.error) || 'That did not save.'; if (r && r.needsReason) st.forceWhy = true; if (el) vsUpdate(el); return false; }
    UI.closeSheet(); VS = null;
    UI.toast(st.mode === 'type' ? `Saved to the draft of ${st.typeName}: ${st.schedule}, ${what}. Check Where it lands, then publish.` : `${st.name}: ${what}.`);
    return undefined;
  }
  function openTier(key, eqId) {
    const e = eqOf(key, eqId); if (!e) { UI.toast('That equipment could not be found.'); return null; }
    const P = plantOf(key); const ti = e.tierSource || {};
    const st = {
      kind: 'tier', mode: 'instance', key, eqId, name: `${e.tag} ${e.name}`, typeName: e.typeName, plantName: P ? P.name : key, title: `Criticality · ${e.tag}`, sub: `${e.typeName} · ${P ? P.name : ''}`,
      fields: [{ id: 'tier', type: 'tier', label: 'Criticality' }], cur: { tier: e.tier }, lib: { tier: ti.libValue || null }, chips: { tier: ti }, vals: { tier: e.tier },
      free: ti.libValue == null, reason: 'tuned', note: '', saveLabel: 'Save', saveAct: 'obj:tiersave',
    };
    prefillWhy(st, key, [ti.overrideId]); st.reason = 'tuned';
    return vsOpen(st);
  }
  function saveTier() {
    const st = VS; if (!st) return false; const el = UI.sheetEl(); if (el) { const n = q1(el, '.o-note'); if (n) st.note = n.value; }
    const v = vsState(st); if (!v.changed) { UI.closeSheet(); UI.toast('Nothing changed.'); return false; }
    const r = safe(() => V().setTier(st.key, st.eqId, st.vals.tier, { reason: 'tuned', note: st.note }), null);
    if (!r || !r.ok) { st.err = (r && r.error) || 'That did not save.'; st.forceWhy = true; if (el) vsUpdate(el); return false; }
    UI.closeSheet(); VS = null; UI.toast(`Criticality of ${st.name.split(' ')[0]}: ${TIER[st.cur.tier] || st.cur.tier} → ${TIER[st.vals.tier] || st.vals.tier}.`); return undefined;
  }

  /* ── report a problem, suggestions, alert state ───────────────────────────────────────────────────────── */
  function report(key, eqId) {
    const Wk = W.V7WORK;
    if (Wk) {
      for (const fn of ['openReport', 'reportProblem', 'report']) if (typeof Wk[fn] === 'function') { try { Wk[fn](key, eqId); return true; } catch (err) { SOFT.push('object7: V7WORK.' + fn + ' ' + (err && err.message)); } }
    }
    const e = eqOf(key, eqId); if (!e) { UI.toast('That equipment could not be found.'); return false; }
    const types = arr(safe(() => V().issueTypes(e.typeName), []));
    const body = types.length
      ? `<p>Pick what you see on ${esc(e.tag)}. It opens an issue with its diagnostic.</p>${UI.radios({ name: 'oIssue', label: 'What is wrong', options: types.map((t) => ({ value: t.id, label: t.name, sub: foundByText(t.foundBy) })) })}`
      : empty(`The library lists no problems for ${e.typeName} yet.`);
    UI.modal({ title: `Report a problem · ${e.tag}`, sub: e.typeName, body, onBind: (el) => { MOD = el; }, foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + (types.length ? btn('Report it', { act: 'obj:rsave', data: { plant: key, eq: eqId }, kind: 'primary' }) : '') });
    return true;
  }
  function openSuggest(o) {
    const lt = o.code ? safe(() => V().libType(o.code), null) : null; const typeName = (lt && lt.typeName) || o.typeName;
    if (!typeName) return;
    UI.modal({
      title: 'Suggest a library change', sub: typeName,
      body: UI.field({ label: 'What should the library change, and why?', html: `<textarea class="o-sg" rows="4" placeholder="For example: DO low should start at 1.8 mg/L for SBRs; 2.0 fires every time the cycle ends">${esc(o.text || '')}</textarea>` }) + '<p class="o-hint">It is logged on the type page and in Activity. Nothing changes until someone edits the library and publishes.</p>',
      onBind: (el) => { MOD = el; },
      foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Send the suggestion', { act: 'obj:sgsave', data: { type: typeName, plant: o.plant || null }, kind: 'primary' }),
    });
  }
  function openOff(key, al, pid) {
    /* v7: the reading keeps coming in; the alert stops firing (its Emergency too); an open issue it opened stays open under its terms */
    const em = al.bands && num(al.bands.emergency) != null ? ` (${dirWord(al.dir)} ${fv(al.bands.emergency, al.unit, al.kind)})` : '';
    const open = al.openIssueId ? safe(() => V().issue(key, al.openIssueId), null) : null;
    const offText = `The ${al.sensorName || 'reading'} reading keeps coming in, but ${al.name} no longer fires and nobody is told, ${em ? `the Emergency${em} included` : 'at any band'}.${open ? ` The open issue ${open.title} (${bandName(open.band)}) stays open under the terms it opened with.` : ''} Say why; the note is kept with the change.`;
    UI.modal({
      title: pid ? `Not for ${UI.plantName(key)}?` : `Turn off ${al.name}?`,
      sub: al.name,
      body: `<p>${esc(pid ? 'It stays in the library for other plants. Say why it does not fit here.' : offText)}</p>${UI.field({ label: 'Why', html: '<textarea class="o-offnote" rows="3"></textarea>' })}`,
      onBind: (el) => { MOD = el; },
      foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(pid ? 'Not for this plant' : 'Turn off', { act: 'obj:aoff', data: { plant: key, alert: al.id, pid }, kind: 'danger' }),
    });
  }

  /* ── handlers ─────────────────────────────────────────────────────────────────────────────────────────── */
  const ga = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null) || null;
  UI.on('obj:limits', (el) => { const mode = ga(el, 'mode'); openLimits(mode === 'type' ? { mode, code: ga(el, 'code'), reading: ga(el, 'reading'), dir: ga(el, 'dir') } : { plant: ga(el, 'plant'), sensorId: ga(el, 'sensor'), dir: ga(el, 'dir') }); return false; });
  UI.on('obj:ldir', (el) => {
    const st = LS; if (!st) return false; const d = ga(el, 'dir');
    const nx = st.mode === 'type' ? lsFromType(st.code, st.reading, d) : lsFromInstance(st.key, st.sensorId, d); if (!nx) return false;
    if (st.mode === 'instance') { nx.reason = st.reason || nx.reason; nx.note = st.note || nx.note; nx.until = st.until || nx.until; }
    nx.range = st.range; LS = nx; UI.refreshSheet({ body: lsBody(nx), foot: lsFoot(nx) }); return false;
  });
  UI.on('obj:lback', (el) => {
    const st = LS; if (!st) return false; const b = ga(el, 'band'); const s = UI.sheetEl();
    st.vals[b] = st.base[b] == null ? '' : String(st.base[b]);
    const inp = q1(s, `[data-band="${b}"]:not(button)`); if (inp) inp.value = st.kind === 'status' ? (st.vals[b] === '' ? '' : (st.dir === 'below' ? '0' : '1')) : st.vals[b];
    if (s) lsUpdate(s); return false;
  });
  UI.on('obj:lsave', () => saveLimits());
  UI.on('obj:ltog', (el) => {
    const st = LS; if (!st) return false; const b = ga(el, 'band'); const s = UI.sheetEl();
    st.vals[b] = st.vals[b] !== '' ? '' : String(tbDefault(st, b));
    if (s) lsUpdate(s); return false;
  });
  UI.on('obj:vback', (el) => {
    const st = VS; if (!st) return false; const f = ga(el, 'f'); const s = UI.sheetEl(); const lib = st.lib[f];
    if (st.kind === 'cadence' && lib) { st.vals.n = String(lib.n); st.vals.unit = lib.unit; const n = q1(s, '[data-f="n"]'); if (n) n.value = st.vals.n; const u = q1(s, '[data-f="unit"]'); if (u) u.value = st.vals.unit; }
    else if (st.kind === 'tier' && lib) { st.vals.tier = lib; const t = q1(s, '[data-f="tier"]'); if (t) t.value = lib; }
    else if (lib != null) { st.vals[f] = String(lib); const i = q1(s, `input[data-f="${f}"]`); if (i) i.value = st.vals[f]; }
    if (s) vsUpdate(s); return false;
  });
  UI.on('obj:timing', (el) => { const mode = ga(el, 'mode'); openTiming(mode === 'type' ? { mode, code: ga(el, 'code'), alert: ga(el, 'alert') } : { plant: ga(el, 'plant'), alertId: ga(el, 'alert') }); return false; });
  UI.on('obj:tsave', () => saveTiming());
  UI.on('obj:cadence', (el) => { const mode = ga(el, 'mode'); openCadence(mode === 'type' ? { mode, code: ga(el, 'code'), schedule: ga(el, 'schedule') } : { plant: ga(el, 'plant'), taskId: ga(el, 'task') }); return false; });
  UI.on('obj:csave', () => saveCadence());
  UI.on('obj:tier', (el) => { openTier(ga(el, 'plant'), ga(el, 'eq')); return false; });
  UI.on('obj:tiersave', () => saveTier());
  UI.on('obj:redirect', (el) => {
    const w = ga(el, 'what'); const st = LS || VS; if (!st) return false;
    const s = UI.sheetEl(); if (s) readWhy(s, st);
    if (w === 'scada') { UI.toast('The plant graph is the only source of equipment and answers. Fix it in the plant graph, then read again.'); return false; }
    if (w === 'fault') {
      if (!LS || LS.mode !== 'instance' || LS.manual) return false;
      const r = safe(() => V().reportSensorFault(LS.key, LS.sensorId, { note: LS.note || '' }), null);
      if (!r || !r.ok) { UI.toast((r && r.error) || 'The sensor fault could not be reported.'); return false; }
      const k = LS.key; UI.closeSheet(); LS = null;
      UI.toast(r.already ? 'A sensor fault is already open for this reading.' : 'Sensor fault reported. Its fix is the probe\'s calibration; the limits stay as they are.');
      UI.go(issueHref(k, r.id)); return false;
    }
    if (w === 'lib') {
      let text = '';
      if (LS) { const bands = lsBands(LS); text = `${LS.plantName} would use ${changesText(LS, bands) || 'different limits'} on ${LS.name} (${dirWord(LS.dir)})`; }
      else if (VS && VS.kind === 'tier') text = `${VS.plantName} would rate ${VS.name} ${TIER[VS.vals.tier] || VS.vals.tier}`;
      else if (VS && VS.kind === 'cadence') text = `${VS.plantName} would do ${VS.name} ${everyText(vsValue(VS, 'every'))}`;
      else if (VS) text = `${VS.plantName} would use must hold for ${VS.vals.hold} min and must clear for ${VS.vals.clear} min on ${VS.name}`;
      if (st.note) text += `: ${st.note}`;
      const r = safe(() => V().suggest({ typeName: st.typeName, text, plant: st.key }), null);
      if (!r || !r.ok) { UI.toast((r && r.error) || 'The suggestion could not be logged.'); return false; }
      UI.closeSheet(); LS = null; VS = null;
      UI.toast(`Suggested to the library for ${st.typeName}. This plant keeps the library value until the library changes.`);
      return undefined;
    }
    return false;
  });
  UI.on('obj:report', (el) => { report(ga(el, 'plant'), ga(el, 'eq')); return false; });
  UI.on('obj:rsave', (el) => {
    const key = ga(el, 'plant'); const eqId = ga(el, 'eq'); const box = MOD || null;
    const pick = q1(box, 'input[name="oIssue"]:checked');
    if (!pick) { UI.toast('Pick what you see first.'); return false; }
    const r = safe(() => V().report(key, eqId, pick.value), null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'The problem could not be reported.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(`Reported: ${r.issue ? r.issue.title : 'a problem'}. Its diagnostic is ready.`);
    UI.go(issueHref(key, r.id)); return false;
  });
  UI.on('obj:scada', () => { UI.toast('The plant graph is the only source of equipment, readings and answers. Fix it in the plant graph, then read again.'); return false; });
  UI.on('obj:suggest', (el) => { openSuggest({ code: ga(el, 'code'), typeName: ga(el, 'type'), plant: ga(el, 'plant') }); return false; });
  UI.on('obj:sgsave', (el) => {
    const t = q1(MOD, '.o-sg'); const text = t ? String(t.value || '').trim() : '';
    if (!text) { UI.toast('Say what the library should change.'); return false; }
    const r = safe(() => V().suggest({ typeName: ga(el, 'type'), text, plant: ga(el, 'plant') }), null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'The suggestion could not be logged.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(`Suggestion logged for ${ga(el, 'type')}. It shows on the type page and in Activity.`); return undefined;
  });
  UI.on('obj:astate', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'alert'); const to = ga(el, 'to'); const pid = ga(el, 'pid');
    const al = safe(() => V().alert(key, id), null); if (!al) return false;
    if (to === 'off') { openOff(key, al, pid); return false; }
    const r = pid && to === 'trial' ? safe(() => V().decide(key, pid, 'accept'), null) : safe(() => V().setAlertState(key, id, to), null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not change.'); return false; }
    UI.toast(to === 'trial' ? `${al.name} is On trial. Firings are recorded; nothing is sent below Emergency.` : to === 'on' ? `${al.name} is On. Firings now open issues and people are told.` : `${al.name}: ${LBL('alertState', to)}.`);
    return undefined;
  });
  UI.on('obj:aoff', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'alert'); const pid = ga(el, 'pid');
    const t = q1(MOD, '.o-offnote'); const why = t ? String(t.value || '').trim() : '';
    if (!why) { UI.toast('Say why first.'); return false; }
    const al = safe(() => V().alert(key, id), null);
    const r = pid ? safe(() => V().decide(key, pid, 'reject', { reason: why }), null) : safe(() => V().setAlertState(key, id, 'off', { note: why }), null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not change.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(pid ? `${al ? al.name : 'The proposal'}: not for this plant.` : `${al ? al.name : 'The alert'} is Off.`); return undefined;
  });

  /* ── routes, deep link, css ───────────────────────────────────────────────────────────────────────────── */
  UI.route('p/:plant/eq/:id/:tab?', equipmentPage);
  UI.route('p/:plant/eq/:id/phone', phonePage);
  UI.route('p/:plant/alert/:id', alertPage);
  let LAST_AUTO = null;
  UI.afterRender((main, path) => {
    const cur = safe(() => UI.current(), null); if (!cur || !cur.params) return;
    const q = cur.params._q || {}; const hash = path + '?' + (cur.query || '');
    if (cur.pattern !== 'p/:plant/eq/:id/:tab?' || !q.limits) { LAST_AUTO = null; return; }
    if (LAST_AUTO === hash) return; LAST_AUTO = hash;
    openLimits({ plant: cur.params.plant, sensorId: q.limits, dir: q.dir || null });
  });
  if (typeof document !== 'undefined' && document && document.head) UI.addCss('assets/object7.css?v=1');

  W.V7OBJ = {
    render, equipmentPage, phonePage, alertPage,
    openLimits, openTiming, openCadence, openTier, report, openSuggest,
    readingCard, limitsLine, typeSites,
    _test: { lsFromInstance, lsFromType, lsBands, lsValidate, lsState, lsPreviewText, setLS: (st) => { LS = st; }, getLS: () => LS, getVS: () => VS, vsState, timingPreview, saveLimits, saveTiming, saveCadence, saveTier },
  };
}());
