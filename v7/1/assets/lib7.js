/* v7 · lib7.js · window.V7LIB — the library list, the type page wrapper, Where it lands + Publish, and the Differences pages.
   Builder B5. Loads after ui7.js (window.V7UI) and object7.js (window.V7OBJ); reads window.V7
   lazily and defensively (every V7 call goes through safe(), failures land in V7UI._soft).

   ROUTES
     #/library[?show=used|unused|draft]          the database's equipment types by family: use at plants, version, draft, workbook counts;
                                                 drafts and suggestions first; search; the "next phase" box (rule 1)
     #/library/:code/:tab?                       the type page = V7OBJ.render({mode:'type', code, tab, aside}) with aside = aside(code);
                                                 a read-only page of its own when object7.js is missing
     #/differences[?show=…&type=CODE]            every plant's differences from the library, attention first, grouped by plant
     #/p/:plant/differences[?show=…&type=CODE]   one plant's, inside V7PLANT.frame(key, 'differences', body) when present
                                                 show = libchanged · review · unrecorded · notinlib · ended (default: everything not ended)
   API
     aside(code) → html            a draft: what the draft changes, Where it lands (per plant, true counts over the four plants), Publish;
                                   no draft: the type's library card (where it is used, its differences, suggestions, published versions)
     differencesBody(plantKey|null, query, baseHref) → html     counts(plantKey|null, typeCode?) → {all,libchanged,review,unrecorded,notinlib,ended}
     libraryPage(params) · typePage(params) · differencesPage(params) · plantDifferencesPage(params)
   ACTIONS (data-act; the shell re-renders after each unless it returns false)
     lib:search (live input) · lib:search-clear · lib:field (live; data-form, data-name[, data-kind]: keeps typed values across re-renders)
     lib:publish · lib:discard (data-code) · lib:revert · lib:keep · lib:keep-save · lib:suggest · lib:suggest-send (data-id = a difference)
   Words on screen follow the plain-words rule: no IDs, no banned words; chips use the exact source and state texts. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const UI = W.V7UI;
  if (!UI) { if (W.console) console.warn('lib7.js needs ui7.js (window.V7UI) loaded first'); return; }
  const V = () => W.V7 || null;
  const { esc, page, chip, stateChip, table, card, section, kv, list, empty, note, filters, field, radios, btn, link, plural } = UI;

  /* ── small helpers ─────────────────────────────────────────────────────────────────────────────────────── */
  function soft(e) { try { if (Array.isArray(UI._soft)) { UI._soft.push('lib7: ' + String(e && e.message || e)); if (UI._soft.length > 200) UI._soft.shift(); } } catch (x) { /* ignore */ } }
  function safe(fn, fb) { try { const v = fn(); return v === undefined || v === null ? fb : v; } catch (e) { soft(e); return fb; } }
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = encodeURIComponent;
  const DAY = 86400000;
  function qs(o) { const s = Object.keys(o).filter((k) => o[k] != null && o[k] !== '' && o[k] !== 'all').map((k) => `${k}=${enc(o[k])}`).join('&'); return s ? '?' + s : ''; }
  function now() { const v = V(); return safe(() => v.now(), null) || Date.UTC(2026, 9, 29, 3, 30); }
  function fmtDay(ms) { return ms == null ? '—' : UI.fmtDay(ms); }
  function fmt(ms) { return ms == null ? '—' : UI.fmt(ms); }
  function plants() { const v = V(); return arr(safe(() => v.plants(), [])); }
  function plantOf(key) { return plants().find((p) => p.key === key) || null; }
  function plantName(key) { const p = plantOf(key); return p ? p.name : String(key || ''); }
  /* 'YYYY-MM-DD' in IST for date inputs; and back (06:00 IST, as core7 reads it) */
  function dateIn(ms) { return new Date(ms + 330 * 60000).toISOString().slice(0, 10); }
  function dateMs(s) { if (!/^\d{4}-\d\d-\d\d$/.test(String(s || ''))) return null; const t = Date.parse(`${s}T06:00:00+05:30`); return isFinite(t) ? t : null; }
  /* "none" is how core7 writes a band with no limit */
  function val(s) { return s == null || s === '' ? '—' : s === 'none' ? 'No limit' : String(s); }
  /* a from/to pair in Where it lands: a band with no value reads "No limit" (cadence and timing texts pass through) */
  function limitText(raw, text) { return raw === null || text === '—' ? 'No limit' : val(text); }
  /* "A", "A and B", "A, B and C"; more than three become "N plants" */
  function namesText(xs) { const a = arr(xs); return a.length > 3 ? `${a.length} plants` : a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`; }

  try { UI.addCss('assets/lib7.css?v=1'); } catch (e) { /* no DOM */ }

  const ST = { q: '', forms: {} };
  function form(k) { return ST.forms[k] || (ST.forms[k] = {}); }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     LIBRARY LIST  #/library
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const SHOW_LIB = [['all', 'All'], ['used', 'Used at a plant'], ['unused', 'Not used yet'], ['draft', 'With a draft']];
  const HAY = new Map();
  function catOf(code) { return (W.CATALOGUE_BY_CODE && W.CATALOGUE_BY_CODE[code]) || arr(W.CATALOGUE).find((c) => c && c.code === code) || null; }
  function hay(t) {
    if (!HAY.has(t.code)) {
      const c = catOf(t.code) || {};
      HAY.set(t.code, [t.typeName, t.code, arr(c.sensors).map((s) => s && s.name).join(' ')].join(' ').toLowerCase());
    }
    return HAY.get(t.code);
  }
  function libShowOk(t, show) { return show === 'used' ? t.plantCount > 0 : show === 'unused' ? !t.plantCount : show === 'draft' ? !!t.draft : true; }
  function typeCell(t) {
    return `<a href="#/library/${esc(enc(t.code))}">${esc(t.typeName)}</a> ${chip(t.code, { mono: true })}`
      + (t.draft ? ' ' + chip('Draft', { tone: 'warn', title: 'Edited, not published yet' }) : '')
      + (t.suggestions ? ' ' + chip(plural(t.suggestions, 'suggestion'), { tone: 'info' }) : '');
  }
  function usedCell(t) {
    if (!t.plantCount) return '<span class="muted">Not used yet</span>';
    return `${esc(plural(t.plantCount, 'plant'))} · ${esc(t.equipmentCount)} equipment<div class="lib-used">${arr(t.plants).map((p) => `${esc(p.name)} ${esc(p.count)}`).join(' · ')}</div>`;
  }
  /* "3 readings, 1 task": only what the type has */
  function counted(parts) { const p = parts.filter((x) => +x[0] > 0).map((x) => plural(x[0], x[1])); return p.length ? p.join(', ') : '<span class="muted">—</span>'; }
  function libTable(rows) {
    return table({
      cols: [
        { label: 'Type', render: typeCell },
        { label: 'Used at', render: usedCell },
        { label: 'Carries', render: (t) => counted([[t.readings, 'reading'], [t.alerts, 'alert'], [t.tasks, 'task']]) },
        { label: 'From the workbook', render: (t) => counted([[t.issues, 'issue'], [t.generalTasks, 'task']]) },
        { label: 'Version', cls: 'r', render: (t) => `<span class="mono">v${esc(t.version)}</span>` },
      ],
      rows: rows.map((t) => Object.assign({}, t, { _href: `#/library/${enc(t.code)}`, _cls: t.plantCount ? '' : 'lib-unused' })),
    });
  }
  function draftsCard(types) {
    const v = V();
    const rows = types.filter((t) => t.draft).map((t) => {
      const wl = safe(() => v.whereItLands(t.code), null);
      const diffs = arr(wl && wl.diffs);
      return {
        title: `${t.typeName} · version ${wl ? wl.nextVersion : t.version + 1}`, href: `#/library/${enc(t.code)}`,
        chips: [wl && wl.kind === 'safety' ? chip('Safety change', { tone: 'bad' }) : ''],
        sub: diffs.length ? diffs.slice(0, 3).map((d) => d.text).join('; ') + (diffs.length > 3 ? `; and ${diffs.length - 3} more` : '') : 'No changes yet',
        right: wl ? landShort(wl) : '',
      };
    });
    if (!rows.length) return '';
    return card({ title: rows.length === 1 ? 'A draft is not published yet' : `${rows.length} drafts are not published yet`, sub: 'Open one to see where it lands, then publish it or discard it.', tone: 'warn', body: list(rows) });
  }
  function suggestionsCard() {
    const v = V(); const sg = arr(safe(() => v.suggestions(), []));
    if (!sg.length) return '';
    const rows = sg.slice(0, 6).map((s) => ({
      title: s.typeName || 'Library', href: s.code ? `#/library/${enc(s.code)}` : null, sub: s.text,
      right: [s.plant ? plantName(s.plant) : '', s.who, fmtDay(s.at)].filter(Boolean).join(' · '),
    }));
    return card({ title: sg.length === 1 ? 'A suggestion from a plant' : `${sg.length} suggestions from plants`, sub: 'Changes plants asked the library to make. Open the type to make the change as a draft.', tone: 'info', body: list(rows) + (sg.length > 6 ? `<p class="small muted mt">And ${esc(sg.length - 6)} more, on their type pages.</p>` : '') });
  }
  function publishedSection() {
    const v = V(); const ch = arr(safe(() => v.S && v.S.lib && v.S.lib.changes, []));
    if (!ch.length) return '';
    const rows = ch.slice(0, 5).map((c) => ({
      title: `${c.typeName} · version ${c.version}`, href: c.code ? `#/library/${enc(c.code)}` : null,
      chips: [c.kind === 'safety' ? chip('Safety change', { tone: 'bad' }) : ''],
      sub: `${c.text || ''}${c.note ? ` — “${c.note}”` : ''}`, right: fmt(c.at),
    }));
    return section('Published lately', list(rows), { sub: 'Each plant it reached has a dated note in its Activity and Coverage.' });
  }
  function libraryPage(params) {
    const v = V(); const types = arr(safe(() => v.libTypes(), []));
    const q = (params && params._q) || {};
    const show = SHOW_LIB.some((s) => s[0] === q.show) ? q.show : 'all';
    const needle = ST.q.trim().toLowerCase();
    const counts = {}; SHOW_LIB.forEach(([id]) => { counts[id] = types.filter((t) => libShowOk(t, id)).length; });
    const shown = types.filter((t) => libShowOk(t, show) && (!needle || hay(t).includes(needle)));
    const fams = [];
    shown.forEach((t) => { let f = fams.find((x) => x.name === t.family); if (!f) fams.push(f = { name: t.family, rows: [] }); f.rows.push(t); });
    fams.forEach((f) => { f.rows = f.rows.filter((t) => t.plantCount).concat(f.rows.filter((t) => !t.plantCount)); });
    const tools = `<div class="lib-tools"><input type="search" id="libSearch" placeholder="Search a type, a code or a reading" aria-label="Search the library" value="${esc(ST.q)}" data-act="lib:search" data-live autocomplete="off">`
      + filters(SHOW_LIB.map(([id, label]) => ({ label, href: '#/library' + qs({ show: id }), on: id === show, count: counts[id] }))) + '</div>';
    const famHtml = fams.length
      ? fams.map((f) => section(f.name, libTable(f.rows), { sub: plural(f.rows.length, 'type') })).join('')
      : empty(needle ? `No type matches “${ST.q.trim()}”.` : 'No type here with this filter.', needle ? btn('Clear the search', { act: 'lib:search-clear' }) : btn('Show every type', { href: '#/library' }));
    const body = [
      draftsCard(types),
      suggestionsCard(),
      `<p class="lib-howto">Types used at a plant come first in each family. To change a type, open it and change a limit, a task's interval or an alert's timing. That makes a draft: Where it lands then shows what would change at each plant, before you publish.</p>`,
      tools,
      `<div class="lib-fams">${famHtml}</div>`,
      publishedSection(),
      note('Grouping equipment into treatment steps, and readings on pipes between equipment — next phase.', 'next'),
    ].filter(Boolean).join('');
    return page({
      title: 'Library',
      sub: `The ${types.length || 56} equipment types the database stores, under their stored names. Each carries its readings and their limits, its alerts and its tasks. Plants follow the library unless they changed a value.`,
      body, cls: 'pg-lib',
    });
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     TYPE PAGE  #/library/:code/:tab?   (the one object page, in type mode)
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const TABS = [['readings', 'Readings'], ['issues', 'Issues'], ['tasks', 'Tasks'], ['details', 'Details']];
  function notFoundType(code) {
    return page({
      crumbs: [{ label: 'Library', href: '#/library' }, { label: 'Not found' }], title: 'No such equipment type',
      body: empty(`“${code || ''}” is not one of the database's equipment types.`, btn('Back to the Library', { href: '#/library' })),
    });
  }
  function typePage(params) {
    const v = V(); const code = params && params.code;
    const t = safe(() => v.libType(code), null);
    if (!t) return notFoundType(code);
    const tab = (params && params.tab) || 'readings';
    const side = aside(code);
    const O = W.V7OBJ;
    if (O && typeof O.render === 'function') {
      let out = null;
      try { out = O.render({ mode: 'type', code, tab, aside: side }); } catch (e) { soft(e); if (W.console) console.error('V7OBJ.render (type ' + code + ') failed; showing the read-only type page', e); }
      if (out) return String(out);
    }
    return fallbackType(t, TABS.some((x) => x[0] === tab) ? tab : 'readings', side);
  }
  /* read-only stand-in when object7.js is missing: same tabs, the library's values */
  function fallbackType(t, tab, side) {
    const base = `#/library/${enc(t.code)}`;
    let body = '';
    if (tab === 'readings') {
      body = arr(t.readings).map((r) => arr(r.dirs).map((d) => {
        const bands = d.draftBands || d.bands || {};
        const words = UI.BANDS.filter((b) => bands[b] != null).map((b) => `${UI.bandName(b)} ${UI.num(bands[b], r.unit)}`).join(' · ') || 'No limits yet';
        return card({ title: `${r.name} · ${d.dir === 'below' ? 'falls below' : 'rises above'}`, sub: words, body: UI.bandBar({ dir: d.dir, bands, valid: r.valid, unit: r.unit }) + `<p class="small muted mt">Must hold for ${esc(d.hold != null ? d.hold : '—')} min · must clear for ${esc(d.clear != null ? d.clear : '—')} min</p>`, actions: [chip(d.draftBands ? 'Draft' : 'From the library', { tone: d.draftBands ? 'warn' : 'lib' })] });
      }).join('')).join('') || empty('This type has no readings in the library.');
      const np = arr(t.nextPhase && t.nextPhase.readings);
      if (np.length) body += note(`Next phase: connections — ${np.map((x) => x.name + (x.note ? ` (${x.note})` : '')).join(', ')}.`, 'next');
    } else if (tab === 'issues') {
      body = list(arr(t.issues).map((i) => ({ title: i.name, sub: arr(i.detection).map((d) => d && d.kind === 'sensor' ? 'Found by a reading' : d && d.kind === 'lab' ? 'Found by a lab test' : 'Found by a person').filter((x, k, a) => a.indexOf(x) === k).join(' · ') }))) || empty('No workbook issues for this type.');
    } else if (tab === 'tasks') {
      body = table({ cols: [{ label: 'Task', key: 'name' }, { label: 'Kind of work', key: 'workLabel' }, { label: 'How often', render: (s) => (s.draftEvery ? `${s.everyText} → draft: ${s.draftEveryText || `every ${s.draftEvery.n} ${s.draftEvery.unit}${s.draftEvery.n > 1 ? 's' : ''}`}` : s.everyText) }], rows: arr(t.schedules), empty: 'No tasks for this type in the library.' });
    } else {
      body = card({ body: kv([['Equipment type', t.typeName], ['Code', `<span class="mono">${esc(t.code)}</span>`], ['Family', t.family], ['Criticality', t.tier || '—'], ['Used at', arr(t.plants).map((p) => `${p.name} (${p.count})`).join(', ') || 'Not used yet']]) });
    }
    return page({
      crumbs: [{ label: 'Library', href: '#/library' }, { label: t.typeName }], title: t.typeName,
      chips: [chip(t.code, { mono: true }), chip(`Library · version ${t.version}`, { tone: 'lib' }), t.draft ? chip('Draft', { tone: 'warn' }) : ''],
      sub: `${t.family}. Plants follow these values unless they changed one.`,
      tabs: TABS.map(([id, label]) => ({ id, label, href: `${base}/${id}` })), active: tab, body, aside: side,
    });
  }

  /* ── the aside: Where it lands + Publish (a draft), or the type's library card ─────────────────────────── */
  function landShort(wl) {
    const t = (wl && wl.totals) || {};
    if (!t.plants && !t.keep) return 'Reaches no plant yet';
    return [`Reaches ${plural(t.plants || 0, 'plant')}`, `${plural(t.values || 0, 'value')} change${t.values === 1 ? 's' : ''}`].join(' · ');
  }
  function landLine(wl) {
    const t = (wl && wl.totals) || {};
    const parts = [`Reaches ${plural(t.plants || 0, 'plant')}`, `${plural(t.values || 0, 'value')} change${t.values === 1 ? 's' : ''}`];
    /* v7: kept VALUES with their tags ("1 value kept here (AT-1)"); core's text already names the tags */
    if (wl && wl.text && /^Reaches /.test(wl.text)) { parts.length = 0; parts.push(wl.text); }
    else if (t.keptValues || t.keep) parts.push(`${plural(t.keptValues != null ? t.keptValues : t.keep, 'value')} kept here`);
    if (t.openIssues) parts.push(`${plural(t.openIssues, 'open issue')} keep${t.openIssues === 1 ? 's its' : ' their'} terms`);
    if (t.dueNow) parts.push(`${plural(t.dueNow, 'task')} fall${t.dueNow === 1 ? 's' : ''} due now`);
    if (t.dueSooner) parts.push(`${plural(t.dueSooner, 'task')} due sooner`);
    return parts.join(' · ');
  }
  function capList(items, rowFn, max) {
    const m = max || 5; if (!items.length) return '';
    const li = (x) => `<li>${rowFn(x)}</li>`;
    const head = `<ul class="wl-l">${items.slice(0, m).map(li).join('')}</ul>`;
    if (items.length <= m) return head;
    return head + `<details class="wl-more"><summary>And ${esc(items.length - m)} more</summary><ul class="wl-l">${items.slice(m).map(li).join('')}</ul></details>`;
  }
  const pair = (w, v) => `<span class="wl-w">${esc(w)}</span><span class="wl-v">${esc(v)}</span>`;
  function plantBlock(p) {
    const parts = [];
    parts.push(`<div class="wl-ph"><a href="#/p/${esc(enc(p.key))}">${esc(p.name)}</a>${stateChip(p.state)}</div>`);
    const fol = arr(p.follows); const chg = arr(p.changedHere); const frm = arr(p.fromForm); const due = arr(p.dueNow); const soon = arr(p.dueSooner);
    if (fol.length) {
      parts.push(`<p class="wl-k">${fol.length === 1 ? 'This value changes' : `These ${fol.length} values change`}</p>`);
      parts.push(capList(fol, (x) => pair(x.what, `${limitText(x.fromValue, x.from)} → ${limitText(x.toValue, x.to)}`) + (x.endsOverride ? '<span class="wl-x">its own value ends</span>' : '')));
    }
    /* v7: a kept value that equals the library's new value says so plainly; going back to the library is then the obvious step */
    const chgDiff = chg.filter((x) => !x.sameAsNew); const chgSame = chg.filter((x) => x.sameAsNew);
    if (chgDiff.length) {
      parts.push(`<p class="wl-k">Changed here, so it keeps its own value and will show Library changed since</p>`);
      parts.push(capList(chgDiff, (x) => pair(x.what, `keeps its own ${val(x.plantValue)} · library ${val(x.newLib)}`)));
    }
    if (chgSame.length) {
      parts.push(`<p class="wl-k">Changed here, and now the same as the library</p>`);
      parts.push(capList(chgSame, (x) => pair(x.what, `keeps its own ${val(x.plantValue)} — now the same as the library`) + '<span class="wl-x">Back to the library value in Differences ends the difference; the value stays</span>'));
    }
    /* v7: a value changed here from the SCADA form's value is measured against the form, so the library change never reaches it */
    const frmForm = frm.filter((x) => !x.changedHere); const frmChanged = frm.filter((x) => x.changedHere);
    if (frmForm.length) {
      parts.push(`<p class="wl-k">Set from the SCADA form, so it stays</p>`);
      parts.push(capList(frmForm, (x) => pair(x.what, `keeps ${val(x.plantValue)}`) + (x.why ? `<span class="wl-x">${esc(x.why)}</span>` : ''), 3));
    }
    if (frmChanged.length) {
      parts.push(`<p class="wl-k">Changed here from the SCADA form value, so the library change doesn't touch it</p>`);
      parts.push(capList(frmChanged, (x) => pair(x.what, `keeps its own ${val(x.plantValue)}${x.formValue ? ` · SCADA form ${val(x.formValue)}` : ''}`) + (x.why ? `<span class="wl-x">${esc(x.why)}</span>` : ''), 3));
    }
    if (p.openIssues) parts.push(`<p class="wl-n">${esc(plural(p.openIssues, 'open issue'))} on these readings keep${p.openIssues === 1 ? 's the terms it' : ' the terms they'} opened under.</p>`);
    if (due.length) {
      parts.push(`<p class="wl-k">Falls due now</p>`);
      parts.push(capList(due, (x) => `<span class="wl-w">${esc(x.task)}</span><span class="wl-x">${esc(x.why || '')}</span>`));
    }
    /* v7: tasks never done since go live: the new interval counts from today */
    if (soon.length) {
      parts.push(`<p class="wl-k">Due sooner</p>`);
      parts.push(capList(soon, (x) => `<span class="wl-w">${esc(x.task)}</span><span class="wl-x">${esc(x.why || '')}</span>`));
    }
    if (!fol.length && !chg.length && !frm.length && !p.openIssues && !due.length && !soon.length) parts.push('<p class="wl-n muted">Nothing changes here: no value at this plant uses these library values yet.</p>');
    return `<div class="wl-p">${parts.join('')}</div>`;
  }
  function draftAside(t, wl) {
    const code = t.code; const F = form('pub:' + code); const diffs = arr(wl.diffs); const safety = wl.kind === 'safety';
    const draftCard = card({
      title: `Draft · version ${wl.nextVersion}`, sub: `Changes to version ${wl.version}. Not published: no plant sees them yet.`, tone: 'warn', cls: 'wl-draft',
      body: `<ul class="wl-l wl-diffs">${diffs.map((d) => `<li><span class="wl-w">${esc(d.text)}</span>${d.safety ? chip('Safety', { tone: 'bad' }) : ''}</li>`).join('')}</ul>`,
      foot: btn('Discard the draft', { act: 'lib:discard', data: { code }, kind: 'ghost', small: true }),
    });
    const used = arr(wl.plants).map((p) => p.key);
    const notUsed = plants().filter((p) => !used.includes(p.key)).map((p) => p.name);
    const reached = (wl.totals && wl.totals.plants) || 0;
    /* v7: when every kept value equals the new library value, nothing will differ: say that instead of "Library changed since" */
    const kept = [].concat(...arr(wl.plants).map((p) => arr(p.changedHere))); const allSame = kept.length > 0 && kept.every((x) => x.sameAsNew);
    const kindNote = safety
      ? note('<b>Safety change</b> — it changes an Emergency limit, so it reaches every plant, including the ones that changed it. Their own value ends, with a note.', 'bad')
      : note(!kept.length ? 'Plants that changed a value keep it. Open issues keep the terms they opened under.' : allSame ? 'Plants that changed a value keep it. Here the kept value is the same as the new library value, so nothing differs any more. Open issues keep the terms they opened under.' : 'Plants that changed a value keep it; they will show Library changed since. Open issues keep the terms they opened under.', 'quiet');
    const pubForm = field({ label: 'Change note', hint: 'Each plant reads it in its Activity and Coverage, dated today. Nothing is pushed to phones.', html: `<textarea id="pubNote-${esc(code)}" name="note" rows="3" placeholder="What changed, and why" data-act="lib:field" data-form="pub:${esc(code)}" data-name="note" data-live>${esc(F.note || '')}</textarea>` })
      + (safety ? field({ label: 'Why this safety change', hint: 'Needed because it overrules plants that set their own value.', html: `<textarea id="pubReason-${esc(code)}" name="reason" rows="2" placeholder="The reason, in a sentence" data-act="lib:field" data-form="pub:${esc(code)}" data-name="reason" data-live>${esc(F.reason || '')}</textarea>` }) : '');
    const landCard = card({
      title: 'Where it lands', sub: landLine(wl), cls: 'wl',
      body: kindNote + arr(wl.plants).map(plantBlock).join('') + (notUsed.length ? `<p class="wl-n muted">Not used at ${esc(notUsed.join(', '))}.</p>` : '') + `<div class="wl-pub">${pubForm}</div>`,
      foot: btn(`Publish version ${wl.nextVersion}${reached ? ` to ${plural(reached, 'plant')}` : ''}`, { act: 'lib:publish', data: { code }, kind: 'primary' }),
    });
    return draftCard + landCard;
  }
  function restAside(t) {
    const v = V(); const code = t.code;
    const used = arr(t.plants);
    const difs = arr(safe(() => v.overrides({}), [])).filter((o) => o.typeCode === code);
    const moved = difs.filter((o) => o.state === 'libchanged').length;
    const body = `<p class="small">Plants follow these values unless they changed one. Change a limit, a task's interval or an alert's timing on this page: it becomes a draft, and this panel shows where it lands before you publish.</p>`
      + (used.length
        ? `<p class="wl-k">Used at</p><ul class="wl-l">${used.map((p) => `<li><a class="wl-w" href="#/p/${esc(enc(p.key))}/equipment">${esc(p.name)}</a><span class="wl-v">${esc(p.count)} equipment</span></li>`).join('')}</ul>`
        : '<p class="wl-n muted">Not used at any plant yet: a change here reaches no plant today.</p>')
      + (difs.length ? `<p class="wl-n">${link(`${plural(difs.length, 'value')} changed at plants`, `#/differences?type=${enc(code)}`)}${moved ? ` · ${esc(moved)} with Library changed since` : ''}</p>` : '');
    const main = card({ title: `Library · version ${t.version}`, sub: t.family, cls: 'wl', body });
    const sg = arr(t.suggestions);
    const sgCard = sg.length ? card({ title: sg.length === 1 ? 'A suggestion from a plant' : `${sg.length} suggestions from plants`, tone: 'info', cls: 'wl', body: `<ul class="wl-sg">${sg.slice(0, 5).map((s) => `<li><p>${esc(s.text)}</p><p class="small muted">${esc([s.plant ? plantName(s.plant) : '', s.who, fmtDay(s.at)].filter(Boolean).join(' · '))}</p></li>`).join('')}</ul>` }) : '';
    const ch = arr(t.changes);
    const chCard = ch.length ? card({ title: 'Published versions', tone: 'quiet', cls: 'wl', body: `<ul class="wl-sg">${ch.slice(0, 5).map((c) => `<li><p><b>Version ${esc(c.version)}</b> · ${esc(fmtDay(c.at))}${c.kind === 'safety' ? ' ' + chip('Safety change', { tone: 'bad' }) : ''}</p><p class="small">${esc(c.text || '')}</p>${c.note ? `<p class="small muted">“${esc(c.note)}”${c.who ? ` · ${esc(c.who)}` : ''}</p>` : ''}</li>`).join('')}</ul>` }) : '';
    return main + sgCard + chCard;
  }
  function aside(code) {
    const v = V(); const t = safe(() => v.libType(code), null);
    if (!t) return '';
    const wl = safe(() => v.whereItLands(code), null);
    return `<div class="lib-aside">${wl ? draftAside(t, wl) : restAside(t)}</div>`;
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     DIFFERENCES  #/differences  and  #/p/:plant/differences
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const SHOW_DIF = [['all', 'All'], ['libchanged', 'Library changed since'], ['review', 'Review due'], ['unrecorded', 'Reason not recorded'], ['notinlib', 'Not in the library'], ['ended', 'Ended']];
  const SHOW_NOTE = {
    libchanged: 'The library changed after these plants changed the value. Keep the plant\'s value, or go back to the library\'s new one.',
    review: 'Their review date has passed. Keep each one with a new date, or send it back to the library.',
    unrecorded: 'Changed before reasons were kept. Keep each one with a reason, or send it back to the library.',
    notinlib: 'Values a plant added that the library does not have. If every plant should have one, suggest it for the library.',
    ended: 'Differences that ended: sent back to the library, ended by their date, or ended by a safety change.',
  };
  function difLists(key, type) {
    const v = V();
    let live = arr(safe(() => v.overrides(key ? { plant: key } : {}), []));
    let ended = arr(safe(() => v.overrides(key ? { plant: key, state: 'ended' } : { state: 'ended' }), []));
    if (type) { live = live.filter((o) => o.typeCode === type); ended = ended.filter((o) => o.typeCode === type); }
    return { live, ended };
  }
  function difOk(o, show) { return show === 'libchanged' ? o.state === 'libchanged' : show === 'review' ? o.state === 'review' : show === 'unrecorded' ? o.reason === 'unrecorded' : show === 'notinlib' ? o.reason === 'notinlib' : true; }
  function counts(key, type) {
    const { live, ended } = difLists(key, type); const c = { ended: ended.length };
    SHOW_DIF.forEach(([id]) => { if (id !== 'ended') c[id] = live.filter((o) => difOk(o, id)).length; });
    return c;
  }
  const rankOf = (o) => (o.state === 'ended' ? 9 : o.state === 'libchanged' ? 0 : o.state === 'review' ? 1 : o.state === 'same' ? 1.5 : o.reason === 'unrecorded' ? 2 : o.reason === 'notinlib' ? 3 : 4);
  function sortDifs(list) {
    const order = plants().map((p) => p.key);
    return list.slice().sort((a, b) => rankOf(a) - rankOf(b) || order.indexOf(a.plant) - order.indexOf(b.plant) || String(a.tag || '').localeCompare(String(b.tag || ''), 'en', { numeric: true }) || String(a.what).localeCompare(String(b.what)));
  }
  function targetHref(o) {
    const t = o.target || {}; const p = `#/p/${enc(o.plant)}`;
    if (t.kind === 'tier') return o.eqId ? `${p}/eq/${enc(o.eqId)}/details` : `${p}/equipment`;
    if (t.alertId && t.kind !== 'limit') return `${p}/alert/${enc(t.alertId)}`;
    if (t.scheduleId) return `${p}/task/${enc(t.scheduleId)}`;
    return o.eqId ? `${p}/eq/${enc(o.eqId)}` : `${p}/readings`;
  }
  function whatText(o) { const k = o.target && o.target.kind; return (k === 'limit' || k === 'reading') && o.tag ? `${o.tag} · ${o.what}` : String(o.what || ''); }
  function difChip(o) {
    if (o.state === 'libchanged') return chip('Library changed since', { tone: 'libchanged' });
    if (o.state === 'same') return chip(o.baseFrom === 'form' ? 'Now the same as the SCADA form' : 'Now the same as the library', { tone: 'ok', title: 'The value it differed from now equals this plant’s value: going back ends the difference and changes nothing' });
    if (o.state === 'review') return chip('Review due', { tone: 'warn' });
    if (o.state === 'ended') return chip('Ended', { tone: 'muted' });
    if (o.reason === 'unrecorded') return chip('Reason not recorded', { tone: 'warn' });
    if (o.reason === 'notinlib') return chip('Not in the library', { tone: 'info' });
    return chip('OK', { tone: 'ok' });
  }
  function nextStep(o) {
    if (o.state === 'ended') return null;
    if (o.state === 'libchanged' || o.state === 'same') return 'revert';
    if (o.state === 'review' || o.reason === 'unrecorded') return 'keep';
    if (o.reason === 'notinlib') return 'suggest';
    return null;
  }
  /* v7: "Back to the SCADA form value" when the base is the form; its reason in plain words ("22 kW motor") */
  const backText = (o) => o.backText || (o.baseFrom === 'form' ? 'Back to the SCADA form value' : 'Back to the library value');
  /* v7: the form's reason only when it says more than the chip ("22 kW motor"), never "(from the SCADA form)" after "SCADA form" */
  const formWhy = (o) => String(o.baseWhy || '').replace(/^From the SCADA form:?\s*/i, '');
  const baseName = (o) => (o.baseFrom === 'form' ? `the SCADA form's ${val(o.libValue)}${formWhy(o) ? ` (${formWhy(o)})` : ''}` : `the library's ${val(o.libValue)}`);
  function difRow(o) {
    const vals = [`<span>Here <b>${esc(val(o.plantValue))}</b></span>`];
    if (o.reason === 'notinlib') vals.push('<span class="muted">The library has no such value</span>');
    else {
      const form = o.baseFrom === 'form';
      vals.push(`<span>${form ? 'SCADA form' : 'Library'} <b>${esc(val(o.libValue))}</b>${form && formWhy(o) ? ` <span class="muted">(${esc(formWhy(o))})</span>` : ''}</span>`);
      if (o.state === 'same') vals.push(`<span class="dif-was">Now the same as the ${form ? 'SCADA form' : 'library'}${o.baseValue && o.baseValue !== o.libValue ? ` (it was ${esc(val(o.baseValue))} when this was changed)` : ''}: going back changes nothing</span>`);
      else if (o.state === 'libchanged' || o.baseDiffers) vals.push(`<span class="dif-was">The ${form ? 'SCADA form' : 'library'} was ${esc(val(o.baseValue))} when this was changed</span>`);
    }
    const why = o.reason === 'unrecorded' ? 'Reason not recorded (changed before reasons were kept)'
      : o.reason === 'notinlib' ? 'Added at this plant'
        : o.reasonLabel || '';
    const whyHtml = `${esc(why)}${o.note ? ` — “${esc(o.note)}”` : ''}`;
    const meta = [];
    meta.push(o.author || o.at != null ? `Changed by ${esc(o.authorText || o.author || 'someone')}${o.at != null ? ` on ${esc(o.atText || fmtDay(o.at))}` : ''}` : 'Who and when: not recorded');
    if (o.state === 'ended') meta.push(`Ended ${esc(fmtDay(o.endedAt))}${o.endedNote ? `: ${esc(o.endedNote)}` : ''}`);
    else if (o.reason === 'fornow' && o.until != null) meta.push(`Back to the library value on ${esc(o.untilText || fmtDay(o.until))}`);
    else meta.push(o.reviewBy != null ? `Review by ${esc(o.reviewByText || fmtDay(o.reviewBy))}` : 'No review date yet');
    if (o.typeCode) meta.push(`Library type ${link(o.typeName || o.typeCode, `#/library/${enc(o.typeCode)}`)}`);
    const step = nextStep(o); const acts = [];
    if (o.state !== 'ended') {
      if (o.reason !== 'notinlib') acts.push(btn(backText(o), { act: 'lib:revert', data: { id: o.id }, small: true, kind: step === 'revert' ? 'secondary' : 'ghost' }));
      acts.push(btn(o.reason === 'unrecorded' ? 'Keep, with a reason…' : 'Keep…', { act: 'lib:keep', data: { id: o.id }, small: true, kind: step === 'keep' ? 'secondary' : 'ghost', title: 'Keep this plant\'s value and choose when to review it' }));
      if (o.typeName) acts.push(btn('Suggest for the library…', { act: 'lib:suggest', data: { id: o.id }, small: true, kind: step === 'suggest' ? 'secondary' : 'ghost' }));
    }
    const tone = o.state === 'libchanged' ? ' tone-warn' : o.state === 'review' ? ' tone-warn' : o.state === 'ended' ? ' tone-muted' : '';
    return `<li class="dif${tone}"><div class="dif-main"><div class="dif-t"><a href="${esc(targetHref(o))}">${esc(whatText(o))}</a>${difChip(o)}</div>`
      + `<div class="dif-v">${vals.join('')}</div><div class="dif-why">${whyHtml}</div><div class="dif-m">${meta.join(' · ')}</div></div>`
      + (acts.length ? `<div class="dif-a">${acts.join('')}</div>` : '') + '</li>';
  }
  function difListHtml(list) { return `<ul class="difs">${list.map(difRow).join('')}</ul>`; }
  function differencesBody(key, query, baseHref) {
    const q = query || {}; const show = SHOW_DIF.some((s) => s[0] === q.show) ? q.show : 'all';
    const type = q.type || null; const base = baseHref || (key ? `#/p/${enc(key)}/differences` : '#/differences');
    const { live, ended } = difLists(key, type);
    const c = counts(key, type);
    const fl = filters(SHOW_DIF.map(([id, label]) => ({ label, href: base + qs({ show: id, type }), on: id === show, count: c[id] })));
    const typeName = type ? ((arr(safe(() => V().libTypes(), [])).find((t) => t.code === type) || {}).typeName || type) : null;
    const typeLine = type ? `<p class="dif-only">Only ${link(typeName, `#/library/${enc(type)}`)} · ${link('Show every type', base + qs({ show }))}</p>` : '';
    const rows = sortDifs(show === 'ended' ? ended : live.filter((o) => difOk(o, show)));
    const intro = SHOW_NOTE[show] ? note(SHOW_NOTE[show], 'quiet') : '';
    let listHtml;
    if (!rows.length) {
      const none = show === 'all' ? (key ? `${plantName(key)} uses the library's values everywhere${type ? ' on this type' : ''}.` : 'Every plant uses the library\'s values.') : 'Nothing here with this filter.';
      listHtml = empty(none, show !== 'all' ? btn('Show all', { href: base + qs({ type }) }) : '');
    } else if (key) {
      listHtml = card({ body: difListHtml(rows) });
    } else {
      /* plants in the order of their most urgent difference, so attention comes first here too */
      const groups = plants().map((p) => ({ p, rows: rows.filter((o) => o.plant === p.key) })).filter((g) => g.rows.length).sort((x, y) => rows.indexOf(x.rows[0]) - rows.indexOf(y.rows[0]));
      listHtml = groups.map((g) => card({
        title: g.p.name, sub: plural(g.rows.length, 'difference'),
        actions: [link('Open at the plant', `#/p/${enc(g.p.key)}/differences${qs({ show, type })}`)],
        body: difListHtml(g.rows),
      })).join('');
      if (show === 'all' && !type) {
        const quiet = plants().filter((p) => !groups.some((g) => g.p.key === p.key)).map((p) => p.name);
        if (quiet.length) listHtml += `<p class="small muted mt">No differences at ${esc(quiet.join(', '))}: ${quiet.length === 1 ? 'it uses' : 'they use'} the library's values everywhere.</p>`;
      }
    }
    return `<div class="dif-wrap">${fl}${typeLine}${intro}${listHtml}</div>`;
  }
  function differencesPage(params) {
    return page({
      title: 'Differences from the library',
      sub: 'Every value a plant uses that is not the library\'s: its reason, who changed it, the library value it started from and when to review it. Send it back to the library, keep it, or suggest it for the library.',
      body: differencesBody(null, (params && params._q) || {}, '#/differences'), cls: 'pg-difs',
    });
  }
  function plantTabs(key) {
    const b = `#/p/${enc(key)}`;
    return [['home', 'Home', b], ['equipment', 'Equipment', b + '/equipment'], ['readings', 'Readings', b + '/readings'], ['issues', 'Issues', b + '/issues'], ['tasks', 'Tasks', b + '/tasks'], ['differences', 'Differences', b + '/differences'], ['activity', 'Activity', b + '/activity']].map(([id, label, href]) => ({ id, label, href }));
  }
  function plantDifferencesPage(params) {
    const key = params && params.plant; const p = plantOf(key);
    if (!p) return page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', body: empty('This plant is not in the prototype.', btn('All Plants', { href: '#/plants' })) });
    const base = `#/p/${enc(key)}/differences`;
    const body = section('Differences from the library', differencesBody(key, params._q || {}, base), { sub: `Every value ${p.name} uses that is not the library's, with its reason. What needs attention comes first.` });
    const P = W.V7PLANT;
    if (P && typeof P.frame === 'function') { const out = safe(() => P.frame(key, 'differences', body), null); if (out) return String(out); }
    return page({
      crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name }], title: p.name,
      chips: [chip(p.type || '', { mono: true }), stateChip(p.state), p.sample === false ? chip('Real SCADA layout', { tone: 'info' }) : chip('Sample plant', { tone: 'muted' })],
      tabs: plantTabs(key), active: 'differences', body,
    });
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     ACTIONS
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const attr = (el, k) => (el && el.getAttribute ? el.getAttribute(k) : null);
  function findOv(id) { const v = V(); return arr(safe(() => v.overrides({ state: 'all' }), [])).find((o) => o.id === id) || null; }
  const closeBtn = (label) => btn(label || 'Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' });

  UI.on('lib:search', (el) => { ST.q = String((el && el.value) || ''); });
  UI.on('lib:search-clear', () => { ST.q = ''; });
  /* typed values live here so a re-render never loses them; a date picked beside a choice also picks that choice */
  UI.on('lib:field', (el) => {
    const f = attr(el, 'data-form'); const n = attr(el, 'data-name'); if (!f || !n) return false;
    const F = form(f); F[n] = el.type === 'checkbox' ? !!el.checked : String(el.value == null ? '' : el.value);
    const k = attr(el, 'data-kind');
    if (k) { F.kind = k; try { const box = el.closest && el.closest('.modal'); const r = box && box.querySelector(`input[type=radio][value="${k}"]`); if (r) r.checked = true; } catch (e) { /* ignore */ } }
    return false;
  });

  UI.on('lib:publish', (el) => {
    const v = V(); const code = attr(el, 'data-code'); if (!v || !code) return false;
    const F = form('pub:' + code); const t = safe(() => v.libType(code), null);
    const wl = safe(() => v.whereItLands(code), null);
    if (!wl) { UI.toast('There is no draft to publish.'); return undefined; }
    if (!String(F.note || '').trim()) { UI.toast('Write a change note first: each plant reads it in its Activity.'); return false; }
    if (wl.needsReason && !String(F.reason || '').trim()) { UI.toast('A safety change needs a reason: it overrules plants that set their own value.'); return false; }
    const r = safe(() => v.publish(code, { note: String(F.note).trim(), reason: F.reason ? String(F.reason).trim() : undefined }), null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'Publishing did not work.'); return false; }
    delete ST.forms['pub:' + code];
    const L = r.landed || wl; const tt = (L && L.totals) || {};
    /* v7: count values, not plants: one plant can both follow (AT-2) and keep its own value (AT-1) */
    const ps = arr(L && L.plants); const folNames = ps.filter((p) => arr(p.follows).length).map((p) => p.name); const keepNames = ps.filter((p) => arr(p.changedHere).length).map((p) => p.name);
    const nVal = tt.values || 0; const nKept = tt.keptValues != null ? tt.keptValues : ps.reduce((n, p) => n + arr(p.changedHere).length, 0);
    const bits = [nVal ? `${plural(nVal, 'value')} change${nVal === 1 ? 's' : ''} at ${namesText(folNames)}` : 'no value changes at any plant'];
    if (nKept) { const there = nVal && folNames.length === 1 && keepNames.length === 1 && keepNames[0] === folNames[0]; const allSame = ps.every((p) => arr(p.changedHere).every((x) => x.sameAsNew)); bits.push(`${plural(nKept, 'value')} ${there ? 'there' : `at ${namesText(keepNames)}`} keep${nKept === 1 ? 's its' : ' their'} own${allSame ? `, now the same as the library` : ''}`); }
    if (tt.dueNow) bits.push(`${plural(tt.dueNow, 'task')} due now`);
    const endedN = arr(L && L.plants).reduce((n, p) => n + arr(p.follows).filter((x) => x.endsOverride).length, 0);
    if (endedN) bits.push(`${plural(endedN, 'plant value')} set at a plant ended by this safety change`);
    UI.toast(`Published ${t ? t.typeName : code} version ${r.version}: ${bits.join('; ')}. Each plant has a dated note in its Activity.`, { ms: 8000 });
    return undefined;
  });
  UI.on('lib:discard', (el) => {
    const v = V(); const code = attr(el, 'data-code'); const t = safe(() => v.libType(code), null); if (!t) return false;
    UI.confirm({
      title: 'Discard this draft?', body: `Your changes to ${t.typeName} are dropped. The library stays at version ${t.version}, and no plant sees anything.`,
      ok: 'Discard the draft', kind: 'danger',
      onOk: () => { safe(() => v.discardDraft(code), null); delete ST.forms['pub:' + code]; UI.toast(`Draft discarded. ${t.typeName} stays at version ${t.version}.`); return undefined; },
    });
    return false;
  });

  /* v7: what going back means beyond the number: an Emergency that goes or comes back, open issues on the reading (any plant state),
     and "it applies at once" only when the value changes */
  function revertTail(o, live, same) {
    const v = V(); const t = o.target || {}; const out = [];
    const sensorId = t.sensorId || (t.alertId ? (safe(() => v.alerts(o.plant, {}), []).find((a) => a.id === t.alertId) || {}).sensorId : null);
    const dir = t.dir || (t.alertId ? (safe(() => v.alerts(o.plant, {}), []).find((a) => a.id === t.alertId) || {}).dir : null);
    if (!same && t.kind === 'limit' && t.band === 'emergency') {
      const al = arr(safe(() => v.alerts(o.plant, { sensorId: t.sensorId }), [])).find((a) => a.dir === t.dir);
      const name = al ? al.name : String(o.what || '').replace(/ · .*$/, '').replace(/ \([^)]*\)$/, '') + (o.tag ? ` on ${o.tag}` : '');
      const gone = o.libRaw == null && o.value != null; const back = o.value == null && o.libRaw != null;
      const how = live ? 'calls everyone and sounds the hooter' : 'is told to the Leads at once (WhatsApp and the app)';
      const noAlert = 'No alert watches this reading here, so nobody is told until one does.';
      if (gone) out.push(`<p class="mt"><b>${esc(name)} will no longer have an Emergency.</b> ${al ? `A reading ${esc(t.dir === 'below' ? 'below' : 'above')} ${esc(val(o.plantValue))} ${live ? 'no longer calls everyone or sounds the hooter' : 'is no longer told to the Leads at once'}; the deepest band left decides who is told.` : esc(noAlert)}</p>`);
      if (back) out.push(`<p class="mt"><b>${esc(name)} gets an Emergency again at ${esc(val(o.libValue))}.</b> ${al ? `A reading past it ${esc(how)}.` : esc(noAlert)}</p>`);
    }
    const open = sensorId ? arr(safe(() => v.issues(o.plant, { status: 'open' }), [])).filter((i) => i.sensorId === sensorId && (!dir || !i.terms || i.terms.dir === dir)) : [];
    if (open.length) out.push(`<p class="small mt">${open.length === 1 ? `The open issue ${esc(open[0].title)} keeps the terms it opened under.` : `${open.length} open issues on this reading keep the terms they opened under.`}</p>`);
    out.push(`<p class="small muted mt">${same ? '' : 'It applies at once. '}The change is written to the plant's Activity.</p>`);
    return out.join('');
  }
  UI.on('lib:revert', (el) => {
    const v = V(); const o = findOv(attr(el, 'data-id'));
    if (!o || o.state === 'ended') { UI.toast('That difference is no longer there.'); return undefined; }
    const live = (plantOf(o.plant) || {}).state === 'live';
    const form = o.baseFrom === 'form'; const where = o.plantName || plantName(o.plant);
    const tail = revertTail(o, live);
    /* v7: the band order is checked before the dialog: when this band alone would leave the bands out of order, the only offer is
       every changed band on the reading together, with what each becomes */
    const pv = safe(() => (v.revertPreview ? v.revertPreview(o.id) : null), null);
    if (pv && pv.needsAll) {
      const reading = o.tag ? `${String(o.what || '').replace(/ · .*$/, '')} on ${o.tag}` : String(whatText(o)).replace(/ · .*$/, ''); const plural2 = form ? 'Back to the SCADA form values' : 'Back to the library values';
      if (!pv.ok) { UI.toast(`${pv.allError || pv.error}.`); return undefined; }
      UI.confirm({
        title: `${plural2} for all ${pv.bands.length} bands?`,
        body: `<p>Going back on this band alone would leave ${esc(reading)}'s bands out of order (${esc(String(pv.error).replace(/^Send .*? back too:\s*/, ''))}). So the ${esc(pv.bands.length)} changed bands at ${esc(where)} go back together:</p><ul class="lib-bands">${pv.bands.map((b) => `<li>${esc(b.bandLabel)}: <b>${esc(val(b.from))}</b> → ${esc(val(b.to))}</li>`).join('')}</ul>${tail}`,
        ok: `${plural2} for all ${pv.bands.length} bands`,
        onOk: () => { const r2 = safe(() => v.revertAll(o.id), null); if (!r2 || !r2.ok) { UI.toast((r2 && r2.error) || 'That did not work.'); return undefined; } UI.toast(`${where}: ${plural(r2.count || 0, 'band')} on ${reading} back to the ${r2.baseFrom === 'form' ? 'SCADA form' : 'library'} values.`); return undefined; },
      });
      return false;
    }
    UI.confirm({
      title: `${backText(o)}?`,
      body: `<p>${o.state === 'same' ? `${esc(whatText(o))} at ${esc(where)} is <b>${esc(val(o.plantValue))}</b>, now the same as ${esc(baseName(o))}. Going back ends the difference; the value does not change.` : `${esc(whatText(o))} at ${esc(where)} goes from <b>${esc(val(o.plantValue))}</b> to ${esc(baseName(o))}.`}</p>${o.state === 'same' ? revertTail(o, live, true) : tail}`,
      ok: form ? 'Use the SCADA form value' : 'Use the library value',
      onOk: () => {
        const r = safe(() => v.revert(o.id), null);
        if (r && !r.ok && r.needsAll && typeof v.revertAll === 'function') {
          UI.confirm({
            title: `${form ? 'Back to the SCADA form values' : 'Back to the library values'} for all bands?`,
            body: `<p>${esc(r.error)}.</p><p class="mt">Send every changed band on ${esc(String(whatText(o)).replace(/ · .*$/, ''))} at ${esc(where)} back together, so the bands stay in order.</p>`,
            ok: `${form ? 'Back to the SCADA form values' : 'Back to the library values'} for all bands`,
            onOk: () => { const r2 = safe(() => v.revertAll(o.id), null); if (!r2 || !r2.ok) { UI.toast((r2 && r2.error) || 'That did not work.'); return undefined; } UI.toast(`${where}: ${plural(r2.count || 0, 'band')} on ${String(whatText(o)).replace(/ · .*$/, '')} back to the ${r2.baseFrom === 'form' ? 'SCADA form' : 'library'} values.`); return undefined; },
          });
          return false;
        }
        if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not work.'); return undefined; }
        UI.toast(`${where}: ${whatText(o)} is back to the ${form ? 'SCADA form' : 'library'} value, ${val(o.libValue)}${form && formWhy(o) ? ` (${formWhy(o)})` : ''}.`);
        return undefined;
      },
    });
    return false;
  });
  UI.on('lib:revert-all', (el) => {
    const v = V(); const o = findOv(attr(el, 'data-id')); if (!o || o.state === 'ended') { UI.toast('That difference is no longer there.'); return undefined; }
    const r = safe(() => v.revertAll(o.id), null); if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not work.'); return undefined; }
    UI.toast(`${o.plantName || plantName(o.plant)}: ${plural(r.count || 0, 'band')} back to the ${r.baseFrom === 'form' ? 'SCADA form' : 'library'} values.`); return undefined;
  });

  function keepBody(o, F) {
    const tomorrow = dateIn(now() + DAY);
    const dateInput = (name, kind) => `<input type="date" name="${name}" value="${esc(F[name] || '')}" min="${tomorrow}" aria-label="${name === 'until' ? 'Until' : 'Review by'}" data-act="lib:field" data-form="keep" data-name="${name}"${kind ? ` data-kind="${kind}"` : ''} data-live>`;
    const head = kv([['Here', `<b class="mono">${esc(val(o.plantValue))}</b>`], [o.baseFrom === 'form' ? 'SCADA form' : 'Library', o.reason === 'notinlib' ? 'Not in the library' : `<span class="mono">${esc(val(o.libValue))}</span>${o.baseFrom === 'form' && formWhy(o) ? ` <span class="muted">(${esc(formWhy(o))})</span>` : ''}`]]);
    const moved = o.state === 'libchanged' ? note(`The library changed from ${val(o.baseValue)} to ${val(o.libValue)} after this plant changed it. Keeping it records the library's new value as the one it differs from.`, 'warn')
      : o.state === 'same' ? note(`The ${o.baseFrom === 'form' ? 'SCADA form' : 'library'} value is now ${val(o.libValue)}, the same as this plant's. ${backText(o)} ends the difference and the value stays ${val(o.plantValue)}.`, 'info') : '';
    const choice = o.reason === 'notinlib'
      ? field({ label: 'Review by', html: dateInput('reviewBy'), hint: 'The library has no such value, so it stays until someone reviews it.' })
      : field({ label: 'How long', html: radios({ name: 'keepKind', value: F.kind, act: 'lib:field', data: { form: 'keep', name: 'kind' }, options: [
        { value: 'tuned', label: 'Tuned for this plant', sub: `Review again by ${dateInput('reviewBy', 'tuned')}` },
        { value: 'fornow', label: 'For now, until a date', sub: `Then back to the library value. Until ${dateInput('until', 'fornow')}` },
      ] }) });
    const noteF = field({ label: 'Note', hint: o.reason === 'unrecorded' ? 'This value was changed before reasons were kept: say why it stays.' : 'Why this plant keeps its own value.', html: `<textarea name="note" rows="3" placeholder="The reason, in a sentence" data-act="lib:field" data-form="keep" data-name="note" data-live>${esc(F.note || '')}</textarea>` });
    return `<div class="lib-keep">${head}${moved}${choice}${noteF}</div>`;
  }
  UI.on('lib:keep', (el) => {
    const o = findOv(attr(el, 'data-id'));
    if (!o || o.state === 'ended') { UI.toast('That difference is no longer there.'); return undefined; }
    const t0 = now();
    const F = ST.forms.keep = {
      id: o.id, kind: o.reason === 'fornow' ? 'fornow' : 'tuned', note: o.note || '',
      reviewBy: dateIn(o.reviewBy != null && o.reviewBy > t0 ? o.reviewBy : t0 + 182 * DAY),
      until: dateIn(o.until != null && o.until > t0 ? o.until : t0 + 30 * DAY),
    };
    UI.modal({ title: 'Keep this plant\'s value', sub: `${o.plantName || plantName(o.plant)} · ${whatText(o)}`, body: keepBody(o, F), foot: closeBtn() + btn('Keep it', { act: 'lib:keep-save', data: { id: o.id }, kind: 'primary' }) });
    return false;
  });
  UI.on('lib:keep-save', (el) => {
    const v = V(); const F = ST.forms.keep || {}; const o = findOv(F.id || attr(el, 'data-id'));
    if (!o || o.state === 'ended') { UI.closeModal(); UI.toast('That difference is no longer there.'); return undefined; }
    if (!String(F.note || '').trim()) { UI.toast('Write a note: why does this plant keep its own value?'); return false; }
    const forNow = F.kind === 'fornow' && o.reason !== 'notinlib';
    const ms = dateMs(forNow ? F.until : F.reviewBy);
    if (ms == null || ms <= now()) { UI.toast('Pick a date after today.'); return false; }
    const r = safe(() => v.keep(o.id, forNow ? { until: ms, note: String(F.note).trim() } : { reviewBy: ms, note: String(F.note).trim() }), null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not work.'); return false; }
    delete ST.forms.keep; UI.closeModal();
    UI.toast(forNow ? `Kept until ${fmtDay(ms)}; then ${o.plantName || plantName(o.plant)} goes back to the library value.` : `Kept at ${o.plantName || plantName(o.plant)}. Review by ${fmtDay(ms)}.`);
    return undefined;
  });

  function suggestText(o) {
    const where = o.plantName || plantName(o.plant);
    if (o.reason === 'notinlib') return `${where} added ${whatText(o)} (${val(o.plantValue)}). Should every ${o.typeName} carry it?`;
    if (o.baseFrom === 'form') return `${where} uses ${val(o.plantValue)} for ${whatText(o)}, where the SCADA form gives ${val(o.libValue)}${formWhy(o) ? ` (${formWhy(o)})` : ''}${o.note ? `; ${o.note}` : ''}. Should the library's rule for it change?`;
    return `${where} uses ${val(o.plantValue)} for ${whatText(o)}, where the library has ${val(o.libValue)}${o.note ? ` (${o.note})` : ''}. Should the library change?`;
  }
  UI.on('lib:suggest', (el) => {
    const o = findOv(attr(el, 'data-id'));
    if (!o || !o.typeName) { UI.toast('This difference has no library type to suggest it for.'); return undefined; }
    const F = ST.forms.sug = { id: o.id, text: suggestText(o) };
    UI.modal({
      title: 'Suggest for the library', sub: `${o.typeName} · from ${o.plantName || plantName(o.plant)}`,
      body: `<p>The suggestion shows on the ${esc(o.typeName)} library page and in Activity. Nothing changes until someone edits the type and publishes it.</p>`
        + field({ label: 'Suggestion', html: `<textarea name="text" rows="4" data-act="lib:field" data-form="sug" data-name="text" data-live>${esc(F.text)}</textarea>` }),
      foot: closeBtn() + btn('Send the suggestion', { act: 'lib:suggest-send', data: { id: o.id }, kind: 'primary' }),
    });
    return false;
  });
  UI.on('lib:suggest-send', (el) => {
    const v = V(); const F = ST.forms.sug || {}; const o = findOv(F.id || attr(el, 'data-id'));
    if (!o || !o.typeName) { UI.closeModal(); UI.toast('That difference is no longer there.'); return undefined; }
    const text = String(F.text || '').trim();
    if (!text) { UI.toast('Say what the library should change.'); return false; }
    const r = safe(() => v.suggest({ typeName: o.typeName, text, plant: o.plant }), null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not work.'); return false; }
    delete ST.forms.sug; UI.closeModal();
    UI.toast(`Suggested for the library: it shows on the ${o.typeName} page and in Activity.`);
    return undefined;
  });

  /* ── routes ──────────────────────────────────────────────────────────────────────────────────────────────── */
  UI.route('library', libraryPage);
  UI.route('library/:code/:tab?', typePage);
  UI.route('differences', differencesPage);
  UI.route('p/:plant/differences', plantDifferencesPage);

  W.V7LIB = {
    aside, differencesBody, counts, libraryPage, typePage, differencesPage, plantDifferencesPage,
    _state: ST, _fallbackType: fallbackType,
  };
}());
