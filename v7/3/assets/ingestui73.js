/* v7/3 · ingestui73.js — the screen for the two readers in ingest73.js. Route #/ingest.
   Step 1 reads the equipment and its types from a plant-graph JSON. Step 2 reads the sensors on that equipment, from the same
   file or from a separate one. Step 3 loads the result as the plant being set up (DigitalPaani) and starts the story again, so
   the whole flow can be walked on it: plant graph, structure, library, limits and what they trigger, go live.
   The pasted text is kept in memory only; a loaded plant graph is kept by ingest73.js.
   ACTIONS (V7UI.on): in:sample in:file in:keep in:read-eq in:read-sn in:same in:load in:clear */
(function () {
  'use strict';
  const W = window; const UI = W.V7UI; const IN = W.V7INGEST; if (!UI || !IN) return;
  const V = () => W.V7;
  const { esc, card, btn, chip, note, plural } = UI;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const ING = { eqText: '', snText: '', name: '', own: false, eq: null, sn: null, err1: '', err2: '', file1: '', file2: '' };
  const val = (id) => { const el = W.document && W.document.getElementById ? W.document.getElementById(id) : null; return el ? el.value : null; };
  const BIG = 300000; const big = () => ING.eqText.length > BIG;
  const errNote = (t) => note('<span>' + esc(t) + '</span>', 'warn');
  /* a very large paste is kept in memory and not written back into the box (it would freeze the page): an empty box then means "keep what was read" */
  function pull() { const a = val('inEq'); if (a != null && !(a === '' && big())) ING.eqText = a; const b = val('inSn'); if (b != null) ING.snText = b; const n = val('inName'); if (n != null) ING.name = n; }

  function readEq() {
    ING.eq = null; ING.sn = null; ING.err1 = ''; ING.err2 = '';
    const p = IN.parse(ING.eqText); if (!p.ok) { ING.err1 = p.error; return; }
    const r = IN.equipment(p.doc); if (!r.ok) { ING.err1 = r.error; return; }
    ING.eq = r; if (!ING.own) readSn();
  }
  function readSn() {
    ING.sn = null; ING.err2 = ''; if (!ING.eq) { ING.err2 = 'Read the equipment first.'; return; }
    let doc = ING.eq.records || ING.eq.src;
    if (ING.own) { const p = IN.parse(ING.snText); if (!p.ok) { ING.err2 = p.error; return; } doc = p.doc; }
    const r = IN.sensors(doc, ING.eq); if (!r.ok) { ING.err2 = r.error; return; } ING.sn = r;
  }

  const tags = (xs, n) => { const a = arr(xs); return `<span class="in-tags">${a.slice(0, n).map((t) => `<span class="mono">${esc(t)}</span>`).join(' ')}${a.length > n ? ` <span class="muted">and ${a.length - n} more</span>` : ''}</span>`; };
  const stat = (n, label, tone) => `<div class="in-stat${tone ? ' in-' + tone : ''}"><b>${esc(String(n))}</b><span>${esc(label)}</span></div>`;
  const pick = (id, which) => `<label class="btn btn-secondary btn-sm in-file">Choose a file<input type="file" accept=".json,application/json,text/plain" data-act="in:file" data-which="${which}" id="${id}"></label>`;

  function eqResult(r) {
    const unk = r.unknown.reduce((n, t) => n + t.count, 0);
    const stats = `<div class="in-stats">${stat(r.rows.length, r.rows.length === 1 ? 'piece of equipment' : 'pieces of equipment')}${stat(r.types.length, r.types.length === 1 ? 'equipment type' : 'equipment types')}${stat(unk, 'not in the database', unk ? 'warn' : 'ok')}</div>`;
    const typeTable = UI.table({
      cols: [{ label: 'Equipment type', key: 't' }, { label: 'Type code on the node', key: 'c', cls: 'nowrap' }, { label: 'Found', key: 'n', cls: 'nowrap' }, { label: 'Equipment', key: 'e' }],
      rows: r.types.map((t) => ({ t: t.known ? `<b>${esc(t.name)}</b>` : `${chip('Not in the database', { tone: 'warn' })}`, c: `<span class="mono">${esc(t.code)}</span>`, n: String(t.count), e: tags(t.tags, 8), _cls: t.known ? '' : 'in-row-warn' })),
    });
    const all = UI.table({
      cols: [{ label: 'Tag', key: 'g', cls: 'nowrap' }, { label: 'Name on the drawing', key: 'l' }, { label: 'Detected type', key: 't' }, { label: 'How it was detected', key: 'h' }],
      rows: r.rows.map((x) => ({ g: `<span class="mono">${esc(x.tag)}</span>`, l: esc(x.label), t: x.known ? esc(x.typeName) : chip('Not in the database', { tone: 'warn' }), h: x.drawnAs ? `The type stored on the node (<span class="mono">${esc(x.dbType)}</span>), not the shape it was drawn with (${esc(x.drawnAs)})` : `The node's type code <span class="mono">${esc(x.code)}</span>` })),
    });
    const o = r.other; const rest = [o.widgets ? plural(o.widgets, 'sensor widget') : '', o.pipes ? plural(o.pipes, 'pipe') : '', o.links ? plural(o.links, 'sensor link') : '', o.drawing ? plural(o.drawing, 'drawing item') + ' (boundaries, joints, buildings)' : '', o.ignored ? plural(o.ignored, 'label or template') : ''].filter(Boolean);
    const warn = r.unknown.length ? note(`<b>${plural(r.unknown.length, 'type code')} the database does not have: ${r.unknown.map((t) => `<span class="mono">${esc(t.code)}</span>`).join(', ')}.</b> That equipment still comes in, with nothing from the library until its type is added.`, 'warn') : '';
    const notes = r.notes.length ? note(r.notes.map(esc).join('<br>'), 'info') : '';
    return `${stats}${warn}${notes}${typeTable}<details class="in-more"><summary>Every piece of equipment, and how its type was detected</summary>${all}</details>${rest.length ? `<p class="muted small in-rest">Also on the drawing, and not equipment: ${esc(rest.join(' · '))}.</p>` : ''}`;
  }
  function snResult(r, eq) {
    const lost = r.unlinked.length + r.stray.length;
    const stats = `<div class="in-stats">${stat(r.rows.length, r.rows.length === 1 ? 'sensor' : 'sensors')}${stat(r.withS, r.withS === 1 ? 'piece of equipment has one' : 'pieces of equipment have one')}${stat(r.bare.length, 'with no sensor', r.bare.length ? 'quiet' : 'ok')}${stat(lost, 'could not be placed', lost ? 'warn' : 'ok')}</div>`;
    const HOW = { widget: 'the kind of widget', code: 'the code it carries', label: 'its label', abbr: 'its abbreviation', tag: 'the abbreviation its tag starts with', category: 'its category' };
    const dash = (s) => (r.fromRecords ? !s.known : !s.reads);
    const tip = (s) => (r.fromRecords ? `${s.sensorTag}${s.how ? ` · known from ${HOW[s.how]}` : ' · abbreviation not in the purpose tags'}${s.library ? '' : ' · no library reading yet'}${s.manual ? ' · entered by hand' : ''}` : s.reads ? `Known from ${HOW[s.how] || 'the widget'}` : 'What it measures is not stated');
    const table = UI.table({
      cols: [{ label: 'Equipment', key: 'e' }, { label: 'Type', key: 't' }, { label: 'Sensors found on it', key: 's' }],
      rows: eq.rows.filter((x) => r.per[x.id]).map((x) => ({ e: `<span class="mono">${esc(x.tag)}</span> ${esc(x.label)}`, t: x.known ? esc(x.typeName) : chip('Not in the database', { tone: 'warn' }), s: r.per[x.id].map((s) => `<span class="in-sn${dash(s) ? ' in-sn-q' : ''}${r.fromRecords && s.known && !s.library ? ' in-sn-p' : ''}" title="${esc(tip(s))}"><b>${esc(s.reads || 'Not stated')}</b> <span class="muted">${esc(s.widgetName)}</span></span>`).join(' ') })),
      empty: 'No sensor is linked to any equipment.',
    });
    const probs = [];
    if (r.unlinked.length) probs.push(`<b>${plural(r.unlinked.length, 'sensor widget')} not linked to anything:</b> ${esc(r.unlinked.slice(0, 8).map((u) => (u.label ? `${u.widget} "${u.label}"` : u.widget)).join(', '))}${r.unlinked.length > 8 ? ` and ${r.unlinked.length - 8} more` : ''}. Left out.`);
    if (r.stray.length) probs.push(`<b>${plural(r.stray.length, 'sensor')} on something that step 1 did not list as equipment:</b> ${esc(r.stray.slice(0, 8).map((u) => `${u.widget}${u.label ? ` "${u.label}"` : ''} → ${u.to}`).join(', '))}${r.stray.length > 8 ? ` and ${r.stray.length - 8} more` : ''}. Left out.`);
    const byName = (xs) => { const m = {}; xs.forEach((x) => { m[x.name] = (m[x.name] || 0) + 1; }); return Object.keys(m).map((k) => `${k} (${m[k]})`).join(', '); };
    const pipeNote = arr(r.pipes).length ? note(`<b>${plural(r.pipes.length, 'sensor')} on pipes, kept for the next phase:</b> ${esc(byName(r.pipes))}. This phase reads sensors on the equipment only; readings on connections come next.`, 'info') : '';
    const notes = (r.notes.length ? note(r.notes.map(esc).join('<br>'), 'info') : '') + pipeNote;
    return `${stats}${probs.length ? note(probs.join('<br>'), 'warn') : ''}${notes}${table}${r.bare.length ? `<details class="in-more"><summary>${plural(r.bare.length, 'piece')} of equipment with no sensor</summary><p>${tags(r.bare.map((x) => x.tag), 200)}</p><p class="muted small">Equipment with no sensor still gets its tasks from the library. Alerts need a reading, so it gets none.</p></details>` : ''}`;
  }

  function page() {
    const k = IN.kept(); const name = V() && V().plantName ? V().plantName(IN.PLANT) : 'DigitalPaani';
    const nEq = V() ? arr(V().equipment(IN.PLANT)).length : 0;
    const keptCard = k
      ? note(`<b>${esc(name)} is running on the plant graph you loaded on ${esc(UI.fmt ? new Date(k.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')}</b>: ${plural(nEq, 'piece')} of equipment. ${k.session ? 'It is held for this session only: the browser has no room to keep it, so reloading the page goes back to the built-in one.' : 'Resetting the story keeps it.'} ${btn('Open the plant', { href: `#/p/${IN.PLANT}`, small: true, kind: 'primary' })} ${btn('Use the built-in plant graph again', { act: 'in:clear', small: true, kind: 'ghost' })}`, 'ok')
      : '';
    const how = '<ol class="fl-how in-how"><li><b>1 · Equipment</b><span>every node, and its equipment type</span></li><li><b>2 · Sensors</b><span>what is linked to each piece</span></li><li><b>3 · Load</b><span>as the plant being set up</span></li><li><b>Walk the flow</b><span>structure, library, limits, go live</span></li></ol>';

    const s1 = card({
      title: 'Step 1 · Read the equipment',
      sub: 'Paste a plant-graph export or the equipment collection, or choose the file. Each node is matched to the database equipment type stored on it.',
      actions: [btn('Use the DigitalPaani export', { act: 'in:sample', small: true, kind: 'ghost', title: 'Fills the box with the real export, so you can change it and read it again' }), pick('inEqFile', 'eq')],
      body: `<textarea class="in-ta" id="inEq" data-act="in:keep" spellcheck="false" aria-label="Plant graph JSON" placeholder='{ "layout": { "cells": [ { "id": "…", "type": "PMP", "equipmentId": "…", "attrs": { "label": { "text": "Feed Pump - 1" } } }, … ] } }'>${big() ? '' : esc(ING.eqText)}</textarea>`
        + (big() ? `<p class="muted small">Holding the ${(ING.eqText.length / 1e6).toFixed(1)} MB you gave. It is not shown in the box, to keep the page quick. Paste again to replace it.</p>` : '')
        + `<div class="in-bar">${btn('Read the equipment', { act: 'in:read-eq', kind: 'primary' })}${ING.file1 ? `<span class="muted small">From ${esc(ING.file1)}</span>` : ''}</div>`
        + (ING.err1 ? errNote(ING.err1) : '') + (ING.eq ? eqResult(ING.eq) : ''),
    });
    const src = `<div class="in-src" role="radiogroup" aria-label="Where the sensors are">`
      + `<label class="radio${ING.own ? '' : ' on'}"><input type="radio" name="inSrc" value="same" data-act="in:same"${ING.own ? '' : ' checked'}><span>In the same file</span></label>`
      + `<label class="radio${ING.own ? ' on' : ''}"><input type="radio" name="inSrc" value="own" data-act="in:same"${ING.own ? ' checked' : ''}><span>In a separate file <span class="muted">(the equipment collection)</span></span></label></div>`;
    const own = ING.own
      ? `<textarea class="in-ta in-ta-s" id="inSn" data-act="in:keep" spellcheck="false" aria-label="Sensors JSON" placeholder='[ { "_id": { "$oid": "…" }, "nodeType": "OS_TANK", "itemDetails": { "answer": [ … ], "sensors": [ { "sensorTag": "LV_OS_TANK_CCT_1:UPT", "sensorTypeAbr": "LV_", "category": "Level Transmitters" } ] } }, … ]'>${esc(ING.snText)}</textarea>`
        + `<p class="muted small">Paste the equipment collection: one record per node, with its sensors under <span class="mono">itemDetails.sensors</span>. Each record is matched to the equipment in step 1 by its id. A second plant graph, or a plain list of sensors, is read too.</p>`
        + `<div class="in-bar">${btn('Read the sensors', { act: 'in:read-sn', kind: 'primary', disabled: !ING.eq })}${pick('inSnFile', 'sn')}${ING.file2 ? `<span class="muted small">From ${esc(ING.file2)}</span>` : ''}</div>`
      : '';
    const s2 = card({
      title: 'Step 2 · Read the sensors on that equipment',
      sub: 'A separate reader. It finds the sensors on each piece of equipment and says what each one measures from its abbreviation (LV is Level, ONOFF is ON/OFF, TRP is Trip), using the purpose tags.',
      body: (ING.eq ? src + own : '<p class="muted">Read the equipment first.</p>') + (ING.err2 ? errNote(ING.err2) : '') + (ING.sn && ING.eq ? snResult(ING.sn, ING.eq) : ''),
      cls: ING.eq ? '' : 'in-off',
    });
    const ready = !!(ING.eq && ING.sn);
    const s3 = card({
      title: 'Step 3 · Load it and walk the flow',
      sub: `Loads this plant graph as ${esc(name)}, the plant being set up, and starts the story again. The other plants and the library stay as they are.`,
      body: ready
        ? `<div class="in-load"><label class="field-l" for="inName">Plant name</label><input type="text" id="inName" class="in-name" data-act="in:keep" value="${esc(ING.name || name)}">${btn(`Load ${plural(ING.eq.rows.length, 'piece')} of equipment and ${plural(ING.sn.rows.length, 'sensor')}`, { act: 'in:load', kind: 'primary' })}</div>`
          + `<ol class="in-next"><li><b>Plant graph</b>: review what was read, type by type.</li><li><b>Structure</b>: confirm the unit processes and place what is left.</li><li><b>Library</b>: accept what each equipment type brings.</li><li><b>Equipment</b>: set limits on a reading and choose what each range triggers.</li><li><b>Go live</b> from the plant's home.</li></ol>`
        : '<p class="muted">Read the equipment and the sensors first.</p>',
      cls: ready ? '' : 'in-off',
    });
    return UI.page({
      title: 'Test a plant graph',
      sub: 'Read any plant-graph JSON in two steps, equipment first and then its sensors, and load it to test the whole flow end to end.',
      body: keptCard + how + s1 + s2 + s3,
    });
  }

  UI.on('in:keep', () => { pull(); return false; });
  UI.on('in:sample', () => { ING.eqText = IN.sampleText(); ING.file1 = 'the built-in DigitalPaani export'; ING.own = false; readEq(); UI.render(); return false; });
  UI.on('in:read-eq', () => { pull(); ING.file1 = ''; readEq(); UI.render(); return false; });
  UI.on('in:read-sn', () => { pull(); readSn(); UI.render(); return false; });
  UI.on('in:same', (el) => { pull(); ING.own = el.value === 'own'; if (ING.eq) { if (ING.own && !String(ING.snText).trim()) { ING.sn = null; ING.err2 = ''; } else readSn(); } UI.render(); return false; });
  UI.on('in:file', (el) => {
    pull(); const f = el.files && el.files[0]; const which = el.getAttribute('data-which'); if (!f || !W.FileReader) return false;
    const fr = new W.FileReader();
    fr.onload = () => { if (which === 'sn') { ING.snText = String(fr.result || ''); ING.file2 = f.name; readSn(); } else { ING.eqText = String(fr.result || ''); ING.file1 = f.name; readEq(); } UI.render(); };
    fr.onerror = () => { UI.toast('That file could not be read.'); };
    fr.readAsText(f); return false;
  });
  function restart(text) { const v = V(); if (v && v.reset) v.reset(); UI.toast(text); }
  UI.on('in:load', () => {
    pull(); if (!ING.eq || !ING.sn) return false;
    UI.confirm({
      title: 'Load this plant graph?',
      body: `It becomes the plant being set up (${plural(ING.eq.rows.length, 'piece')} of equipment, ${plural(ING.sn.rows.length, 'sensor')}), and the story starts again: everything you changed in the console is cleared. Your calls on the Decisions page are kept.`,
      ok: 'Load and start again', kind: 'primary',
      onOk: () => {
        const r = IN.use(ING.eqText, ING.own ? ING.snText : '', { name: ING.name });
        if (!r.ok) { if (r.step === 2) ING.err2 = r.error; else ING.err1 = r.error; UI.toast(r.error); UI.render(); return false; }
        restart(r.session ? `Loaded for this session: ${plural(r.eq.rows.length, 'piece')} of equipment and ${plural(r.sn.rows.length, 'sensor')}. The browser has no room to keep it, so reloading the page goes back to the built-in plant graph.` : `Loaded: ${plural(r.eq.rows.length, 'piece')} of equipment and ${plural(r.sn.rows.length, 'sensor')}. The plant is ready to set up.`);
        UI.go(`#/p/${IN.PLANT}`); return false;
      },
    });
    return false;
  });
  UI.on('in:clear', () => {
    UI.confirm({
      title: 'Use the built-in plant graph again?', body: 'The plant goes back to the DigitalPaani export that ships with the console, and the story starts again.', ok: 'Use the built-in one', kind: 'danger',
      onOk: () => { IN.clear(); restart('Back on the built-in DigitalPaani plant graph.'); UI.render(); return false; },
    });
    return false;
  });

  UI.route('ingest', page);
  W.V7INGESTUI = { page, _state: ING, _readEq: readEq, _readSn: readSn };
}());
