/* v7/3 · ingest73.js — two readers for a plant-graph JSON, so the whole flow can be tested on any export.
   READER 1, equipment(doc): finds every piece of equipment drawn and says which database equipment type it is. The rule is the
     console's own (window.detectDbType): the type stored on the node wins over the shape it was drawn with; a code the database
     does not have is still equipment, shown as "not in the database". Tags come from labels, as scadaFromLayout() makes them.
   READER 2, sensors(doc, eq): finds the sensors on that equipment. From a plant graph it follows each dashed link from a widget
     to the equipment it reads; from a plain list ([{ equipmentId | equipmentTag | equipmentLabel, widget, code, reading }]) it
     matches each row to a piece of equipment reader 1 found. It says what each sensor reads (window.READINGS) and lists what it
     could not place.
   build(eq, sn, meta) joins the two into the model the console reads; use(text, text, meta) keeps it in localStorage
   ('ctl74.ingest') and makes it the plant graph of the plant being set up (DigitalPaani); clear() goes back to the built-in one.
   This file runs before the core boots, so a kept plant graph is already in place when the story is seeded or restored.
   window.V7INGEST = { parse, equipment, sensors, build, read, use, clear, kept, sampleText, applyKept, PLANT } */
(function () {
  'use strict';
  const W = window; const KEY = 'ctl74.ingest'; const PLANT = 'digitalpaani';
  const arr = (x) => (Array.isArray(x) ? x : []);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const BUILT_IN = W.SCADA_SAMPLES && W.SCADA_SAMPLES[PLANT] ? clone(W.SCADA_SAMPLES[PLANT]) : null;
  const STRUCT0 = W.V7_STRUCTURE && W.V7_STRUCTURE[PLANT] ? clone(W.V7_STRUCTURE[PLANT]) : null;
  const db = (code) => (W.DB_BY_CODE || {})[code] || null;
  const text = (c) => String((c && c.attrs && c.attrs.label && c.attrs.label.text) || (c && c.label) || (c && c.name) || '').replace(/\s+/g, ' ').trim();
  const isLine = (c) => c.type === 'Pipe' || c.type === 'standard.Link';

  function parse(str) {
    const s = String(str || '').trim(); if (!s) return { ok: false, error: 'Nothing to read yet. Paste the JSON or choose a file.' };
    try { return { ok: true, doc: JSON.parse(s) }; } catch (e) { return { ok: false, error: `This is not valid JSON: ${String(e.message || e).slice(0, 140)}` }; }
  }
  /* the export as the API returns it wraps the drawing: { results: { layout: { cells } } } (also data / result / an array of one) */
  const unwrap = (doc) => { let d = doc; for (let i = 0; i < 4 && d && typeof d === 'object' && !Array.isArray(d) && !d.layout && !d.cells; i++) { const k = ['results', 'result', 'data', 'payload', 'doc'].find((x) => d[x] && typeof d[x] === 'object'); if (!k) break; d = Array.isArray(d[k]) && d[k].length === 1 ? d[k][0] : d[k]; } return d; };
  /* what the console needs from a cell, without how it is drawn (SVG markup, ports, anchors): keeps a kept plant graph small */
  const slimCell = (c) => { const o = { type: c.type, id: c.id }; ['equipmentId', 'equipmentType', 'level', 'value', 'code', 'sensorCode', 'sensorTag', 'measures'].forEach((k) => { if (c[k] != null) o[k] = c[k]; }); const t = c.attrs && c.attrs.label && c.attrs.label.text; if (t != null) o.attrs = { label: { text: t } }; if (c.source && c.source.id) o.source = { id: c.source.id }; if (c.target && c.target.id) o.target = { id: c.target.id }; return o; };
  const slim = (doc0) => { const doc = unwrap(doc0); if (isRecords(doc)) return slimRecords(doc); const cells = cellsOf(doc); if (!cells) return doc0; const d = Array.isArray(doc) ? {} : doc; return { ...(d.version != null ? { version: d.version } : {}), ...(d.updatedAt ? { updatedAt: d.updatedAt } : {}), layout: { cells: cells.map(slimCell) } }; };
  /* the equipment collection: one record per node, [{ _id, nodeType, itemDetails: { answer: [...], sensors: [...], source, target } }] */
  const oid = (x) => (x && typeof x === 'object' ? String(x.$oid || x._id || x.id || '') : String(x == null ? '' : x));
  const isRecords = (doc) => Array.isArray(doc) && doc.length > 0 && doc.every((r) => r && typeof r === 'object') && doc.some((r) => r.nodeType && r.itemDetails);
  const recName = (r) => { const a = arr(r.itemDetails && r.itemDetails.answer).find((x) => x && x.question === 'Name'); return String((a && typeof a.answer === 'string' && a.answer) || '').replace(/\s+/g, ' ').trim(); };
  const live = (list) => list.filter((r) => r && r.nodeType && !r.isArchived);
  /* the same records as a drawing: a node per record, a pipe per Pipe record (its two ends are equipment ids) */
  const fromRecords = (list) => ({ fromRecords: true, layout: { cells: live(list).map((r) => { const id = oid(r._id); const d = r.itemDetails || {}; return r.nodeType === 'Pipe' ? { type: 'Pipe', id, source: { id: oid(d.source) }, target: { id: oid(d.target) }, attrs: { label: { text: recName(r) } } } : { type: r.nodeType, id, equipmentId: id, attrs: { label: { text: recName(r) } } }; }) } });
  const slimRecords = (list) => live(list).map((r) => { const d = r.itemDetails || {}; return { _id: oid(r._id), nodeType: r.nodeType, itemDetails: { answer: [{ question: 'Name', answer: recName(r) }], ...(d.source ? { source: oid(d.source) } : {}), ...(d.target ? { target: oid(d.target) } : {}), ...(arr(d.sensors).length ? { sensors: arr(d.sensors).map((s) => { const o = { _id: oid(s._id) }; ['sensorTag', 'sensorTypeAbr', 'sensorName', 'category', 'dataType', 'isEnabled'].forEach((k) => { if (s[k] != null) o[k] = s[k]; }); return o; }) } : {}) } }; });
  const cellsOf = (doc0) => { let doc = unwrap(doc0); if (isRecords(doc)) doc = fromRecords(doc); const d = doc && (doc.layout || doc); const c = Array.isArray(doc) ? doc : d && d.cells; return Array.isArray(c) && c.length && c.every((x) => x && typeof x === 'object') && c.some((x) => x.type && x.id) ? c : null; };

  /* READER 1 */
  function equipment(doc0) {
    const raw = unwrap(doc0); const records = isRecords(raw) ? raw : null; const doc = records ? fromRecords(records) : raw; const cells0 = cellsOf(doc);
    if (!cells0) return { ok: false, error: 'No plant graph found in this JSON. It should carry the cells of the drawing: { "layout": { "cells": [ … ] } }.' };
    const notes = []; const seenId = new Set(); let noId = 0, dup = 0;
    /* a node with no equipment id is read under its cell id; a repeated equipment id gets a suffix, so nothing is merged */
    const cells = cells0.map((c) => {
      if (isLine(c)) return c; const row = db(c.equipmentType || c.type); const kind = row ? row.kind : 'equipment'; if (kind !== 'equipment') return c;
      const x = { ...c }; if (!x.equipmentId) { x.equipmentId = String(x.id); noId++; }
      if (seenId.has(x.equipmentId)) { dup++; let k = 2; while (seenId.has(`${x.equipmentId}~${k}`)) k++; x.equipmentId = `${x.equipmentId}~${k}`; }
      seenId.add(x.equipmentId); return x;
    });
    if (noId) notes.push(`${plural(noId, 'node')} had no equipment id, so ${noId === 1 ? 'it is' : 'they are'} read under ${noId === 1 ? 'its' : 'their'} drawing id.`);
    if (dup) notes.push(`${plural(dup, 'node')} repeated an equipment id already used; each is kept as its own piece of equipment.`);
    const src = Array.isArray(doc) ? { layout: { cells } } : { ...doc, ...(doc.layout ? { layout: { ...doc.layout, cells } } : { cells }) };
    let model; try { model = W.scadaFromLayout(src, { name: 'Plant', type: 'STP' }); } catch (e) { return { ok: false, error: `The plant graph could not be read: ${String(e.message || e).slice(0, 140)}` }; }
    /* a name that is only a number (a valve labelled "3456") has no letters to make a tag from: its tag is its name */
    const tagsUsed = new Set(model.equipment.map((e) => e.tag));
    model.equipment.forEach((e) => { if (/^[A-Za-z]/.test(e.tag || '')) return; let t = (e.label || '').trim() || String(e.id).slice(-6); const b = t; for (let k = 2; tagsUsed.has(t); k++) t = `${b}.${k}`; tagsUsed.add(t); e.tag = t; });
    /* a node that is the body of a treatment step is offered the unit-process library when other equipment takes part in it,
       and the equipment library when it stands on its own */
    const offers = W.V7NODES ? W.V7NODES.plan(model, STRUCT0) : []; const offerOf = {}; offers.forEach((o) => { offerOf[o.eqId] = o; });
    const rows = model.equipment.map((e) => {
      const o = offerOf[e.id] || null; const det = W.detectDbType(o ? { ...e, offer: o } : e); const known = !det.notInDb;
      return { id: e.id, cell: e.cell, label: e.label || '(no name)', tag: e.tag, code: e.code, dbType: det.dbType, typeName: known ? det.type : null, known, drawnAs: o ? null : det.drawnAs || null, noName: !e.label, offer: o, read: det.read || null, process: !!(o && o.library === 'process') };
    });
    if (!rows.length) return { ok: false, error: 'This plant graph has no equipment on it.' };
    const by = {}; const types = [];
    rows.forEach((r) => { let g = by[r.dbType]; if (!g) { g = by[r.dbType] = { code: r.dbType, name: r.typeName, known: r.known, process: r.process, count: 0, tags: [] }; types.push(g); } g.count++; g.tags.push(r.tag); });
    types.sort((a, b) => (a.known === b.known ? b.count - a.count || String(a.name || a.code).localeCompare(String(b.name || b.code)) : a.known ? 1 : -1));
    const other = { widgets: 0, drawing: 0, ignored: 0, pipes: cells.filter((c) => c.type === 'Pipe').length, links: cells.filter((c) => c.type === 'standard.Link').length };
    cells.forEach((c) => { if (isLine(c)) return; const row = db(c.equipmentType || c.type); const k = row ? row.kind : 'equipment'; if (k === 'widget') other.widgets++; else if (k === 'drawing') other.drawing++; else if (k === 'ignore') other.ignored++; });
    const nameless = rows.filter((r) => r.noName).length; if (nameless) notes.push(`${plural(nameless, 'piece')} of equipment ${nameless === 1 ? 'has' : 'have'} no name on the drawing.`);
    return { ok: true, rows, types, unknown: types.filter((t) => !t.known), other, notes, offers, cells: cells.length, site: model.site, drawn: model.drawn, version: model.fromLayout && model.fromLayout.version, model, src, records };
  }

  /* ── what a sensor measures, from its abbreviation (the purpose tags) ─────────────────────────
     A sensor's tag starts with its abbreviation: LV_OS_TANK_CCT_1:UPT is LV, a Level. The record also carries it as
     sensorTypeAbr ("LV_"). The longest abbreviation that fits wins (ONOFF before ON, VFDONOFF before VFD…). */
  const ALIAS = { LT: 'LV', LVL: 'LV', LEVEL: 'LV' };
  /* the purposes the library already has a reading for (window.READINGS tags): these get the type's limits and alerts */
  const TO_READING = { onOff: 'RUN', vfdOnOrOff: 'RUN', trip: 'TRIP', autoManual: 'AM', level: 'LVL', current: 'AMP', averageCurrent: 'AMP', vfdAmpere: 'AMP', vibration: 'VIB', pumpRunningTime: 'HRS', ph: 'PH', orp: 'ORP', do: 'DO', mlss: 'MLSS', temperature: 'TEMP', turbidity: 'TURB', chlorine: 'FRC', conductivity: 'COND', pressure: 'PRESS', flowRate: 'FLOW', flooding: 'FLOOD', LoadCellWeight: 'WT' };
  const ON_OFF = /on\/off|trip|auto\/manual|switch|valve status|bar screen|manual input|flooding|hooter|fault|decanter|cycles|alarm|bypass|auto check|control|bidirectional/i;
  const START = { LVL: 55, AM: 1, TRIP: 0, PH: 7.2, DO: 2.1, MLSS: 3200, TEMP: 29, ORP: 150, FRC: 0.5, TURB: 2, COND: 800, PRESS: 0.5 };
  let TAGS = null;
  const tagsBy = () => { if (!TAGS) { TAGS = {}; arr(W.V7_PURPOSE_TAGS).forEach((t) => { TAGS[String(t.abbr).toUpperCase()] = t; }); } return TAGS; };
  function purposeOf(s) {
    const by = tagsBy(); const norm = (a) => String(a || '').replace(/_+$/, '').trim().toUpperCase();
    const a1 = norm(s.sensorTypeAbr); if (a1 && by[ALIAS[a1] || a1]) return { tag: by[ALIAS[a1] || a1], abbr: a1, how: 'abbr' };
    const st = String(s.sensorTag || '').toUpperCase(); let best = null;
    Object.keys(by).concat(Object.keys(ALIAS)).forEach((k) => { if (st.startsWith(k + '_') && (!best || k.length > best.length)) best = k; });
    if (best) return { tag: by[ALIAS[best] || best], abbr: best, how: 'tag' };
    const cat = String(s.category || '').trim().toLowerCase(); const same = cat ? Object.values(by).filter((t) => String(t.category).toLowerCase() === cat) : [];
    if (same.length === 1) return { tag: same[0], abbr: same[0].abbr, how: 'category' };
    return { tag: null, abbr: a1 || st.split(/[_:]/)[0] || '', how: null };
  }
  /* reader 2 on the equipment collection: every enabled sensor in itemDetails.sensors, on the record's own equipment */
  function sensorsFromRecords(list, eq) {
    const rows = []; const stray = []; const pipes = []; const notes = []; let off = 0; const seen = new Set();
    const eqById = {}; eq.rows.forEach((r) => { eqById[r.id] = r; });
    live(list).forEach((rec) => {
      const ss = arr(rec.itemDetails && rec.itemDetails.sensors); if (!ss.length) return;
      const id = oid(rec._id); const e = eqById[id]; const row = db(rec.nodeType); const kind = rec.nodeType === 'Pipe' ? 'pipe' : row ? row.kind : 'equipment';
      if (!e && (kind === 'widget' || kind === 'ignore')) return;   /* a widget only shows a sensor that already sits on its equipment */
      ss.forEach((s) => {
        if (!s || typeof s !== 'object' || (!s.sensorTag && !s.sensorTypeAbr)) return;
        if (s.isEnabled === false) { off++; return; }
        const p = purposeOf(s); const label = recName(rec);
        const own = String(s.sensorName || s.sensorNickName || '').replace(label, '').replace(/\s+/g, ' ').trim();
        const name = p.tag ? p.tag.name : (own && own.toUpperCase() !== p.abbr ? own : String(s.category || p.abbr || 'Sensor'));
        if (kind === 'pipe') { pipes.push({ name, abbr: p.abbr, on: label }); return; }
        if (!e) { stray.push({ widget: name, label: '', to: kind === 'drawing' ? `${label || rec.nodeType} (not equipment)` : `${label || id} (not in step 1)` }); return; }
        const key = `${e.id}|${s.sensorTag || p.abbr}`; if (seen.has(key)) return; seen.add(key);
        const lib = p.tag ? TO_READING[p.tag.key] || null : null; const tag = lib || p.abbr || 'SENSOR';
        const onOff = s.dataType === 'boolean' || ON_OFF.test(String((p.tag && p.tag.category) || s.category || ''));
        const num = (e.label.match(/(\d+)$/) || [])[1];
        const reading = tag === 'RUN' ? (num && +num % 2 === 0 ? 0 : 1) : START[tag] != null ? START[tag] : 0;
        rows.push({ eqId: e.id, eqTag: e.tag, eqLabel: e.label, eqType: e.typeName || 'not in the database', widget: onOff ? 'SWITCH_SENSOR' : 'NUMBER_SENSOR', widgetName: p.abbr, tag, reads: name, how: p.how, reading, abbr: p.abbr, sensorTag: s.sensorTag || '', known: !!p.tag, library: !!lib, manual: s.dataInputType === 'manual' });
      });
    });
    const unk = {}; rows.filter((r) => !r.known).forEach((r) => { unk[r.abbr] = (unk[r.abbr] || 0) + 1; });
    if (Object.keys(unk).length) notes.push(`${plural(Object.keys(unk).length, 'abbreviation')} the purpose tags do not have: ${Object.keys(unk).map((k) => `${k} (${unk[k]})`).join(', ')}. ${Object.keys(unk).length === 1 ? 'Its sensors come' : 'Their sensors come'} in under their own name.`);
    const plain = {}; rows.filter((r) => r.known && !r.library).forEach((r) => { plain[r.reads] = (plain[r.reads] || 0) + 1; });
    if (Object.keys(plain).length) notes.push(`Recognised, but the library has no reading for ${Object.keys(plain).length === 1 ? 'it' : 'them'} yet: ${Object.keys(plain).map((k) => `${k} (${plain[k]})`).join(', ')}. ${Object.keys(plain).length === 1 ? 'It comes' : 'They come'} in as a plain reading, with no alerts until the library has one.`);
    if (off) notes.push(`${plural(off, 'sensor')} switched off in the collection ${off === 1 ? 'is' : 'are'} left out.`);
    return { rows, stray, pipes, notes };
  }

  /* what a widget reads: what kind of widget it is, else the code it carries, else its label */
  const readingByTag = (tag) => { const R = W.READINGS || {}; const n = Object.keys(R).find((k) => R[k].tag === tag); return n || null; };
  const tagByName = (name) => { const R = W.READINGS || {}; const want = String(name == null ? '' : name).trim().toLowerCase(); if (!want) return null; const n = Object.keys(R).find((k) => k.toLowerCase() === want || String(R[k].tag).toLowerCase() === want); return n ? R[n].tag : null; };
  function codeOfWidget(w) {
    const own = tagByName(w.code) || tagByName(w.sensorCode) || tagByName(w.sensorTag) || tagByName(w.measures); if (own) return { tag: own, how: 'code' };
    const fixed = (W.LAYOUT_WIDGET_CODES || {})[w.type]; if (fixed) return { tag: fixed, how: 'widget' };
    const lab = tagByName(text(w)); if (lab) return { tag: lab, how: 'label' };
    return { tag: String(w.type || 'SENSOR'), how: null };
  }
  const widgetName = (type) => (W.SCADA_WIDGETS || {})[type] || (db(type) ? db(type).name : type || 'Sensor');
  const sensorRow = (e, widget, code, reading) => ({ eqId: e.id, eqTag: e.tag, eqLabel: e.label, eqType: e.typeName || 'not in the database', widget, widgetName: widgetName(widget), tag: code.tag, reads: readingByTag(code.tag), how: code.how, reading });

  /* READER 2 */
  function sensors(doc0, eq) {
    const doc = unwrap(doc0);
    if (!eq || !eq.ok) return { ok: false, error: 'Read the equipment first: sensors are found on the equipment it lists.' };
    let rows = []; const unlinked = []; let stray = []; let notes = []; let pipes = [];
    const cells = isRecords(doc) ? null : cellsOf(doc);
    if (isRecords(doc)) {
      const r = sensorsFromRecords(doc, eq); rows = r.rows; stray = r.stray; pipes = r.pipes; notes = r.notes;
    } else if (cells) {
      const byCell = {}; cells.forEach((c) => { if (!isLine(c)) byCell[c.id] = c; });
      const kind = (c) => { const r = db(c.equipmentType || c.type); return r ? r.kind : 'equipment'; };
      const eqByCell = {}; const eqById = {}; eq.rows.forEach((r) => { eqByCell[r.cell] = r; eqById[r.id] = r; });
      const linked = new Set();
      cells.filter((c) => c.type === 'standard.Link').forEach((l) => {
        const a = byCell[l.source && l.source.id], b = byCell[l.target && l.target.id];
        const w = a && kind(a) === 'widget' ? a : b && kind(b) === 'widget' ? b : null; if (!w) return;
        const o = w === a ? b : a; const e = o ? (eqByCell[o.id] || (kind(o) === 'equipment' ? eqById[o.equipmentId] : null)) : null;
        linked.add(w.id);
        if (!e) { stray.push({ widget: widgetName(w.type), label: text(w), to: o ? (text(o) || o.type) : 'nothing' }); return; }
        const num = (e.label.match(/(\d+)$/) || [])[1];
        rows.push(sensorRow(e, w.type, codeOfWidget(w), w.type === 'LEVEL_SENSOR' ? (w.level ?? 0) : w.type === 'SWITCH_SENSOR' ? (num && +num % 2 === 0 ? 0 : 1) : (Number.isFinite(+w.value) ? +w.value : 0)));
      });
      cells.filter((c) => !isLine(c) && kind(c) === 'widget' && !linked.has(c.id)).forEach((w) => unlinked.push({ widget: widgetName(w.type), label: text(w) }));
    } else {
      const list = Array.isArray(doc) ? doc : doc && Array.isArray(doc.sensors) ? doc.sensors : null;
      if (!list) return { ok: false, error: 'No sensors found in this JSON. It should be a plant graph (with cells), or a list of sensors: [ { "equipmentTag": "RFP-1", "widget": "NUMBER_SENSOR", "code": "AMP" } ].' };
      const low = (s) => String(s == null ? '' : s).trim().toLowerCase();
      const find = (s) => { const id = s.equipmentId ?? s.eqId ?? s.equipment; const tag = s.equipmentTag ?? s.equipment; const label = s.equipmentLabel ?? s.equipmentName ?? s.equipment; return eq.rows.find((r) => id != null && String(r.id) === String(id)) || eq.rows.find((r) => tag != null && low(r.tag) === low(tag)) || eq.rows.find((r) => label != null && low(r.label) === low(label)) || null; };
      list.forEach((s, i) => {
        if (!s || typeof s !== 'object') { stray.push({ widget: 'Row ' + (i + 1), label: '', to: 'not a sensor' }); return; }
        const widget = s.widget || s.widgetType || s.sensorType || s.type || 'NUMBER_SENSOR'; const e = find(s);
        const w = { type: widget, code: s.code ?? s.sensorCode ?? s.tag, measures: s.measures ?? s.reads, label: s.name ?? s.label };
        if (!e) { stray.push({ widget: widgetName(widget), label: text(w), to: String(s.equipmentId ?? s.eqId ?? s.equipmentTag ?? s.equipmentLabel ?? s.equipmentName ?? s.equipment ?? 'no equipment named') }); return; }
        const v = s.reading ?? s.value; rows.push(sensorRow(e, widget, codeOfWidget(w), v != null && Number.isFinite(+v) ? +v : widget === 'SWITCH_SENSOR' ? 1 : 0));
      });
    }
    const per = {}; rows.forEach((r) => { (per[r.eqId] = per[r.eqId] || []).push(r); });
    const withS = Object.keys(per).length; const bare = eq.rows.filter((r) => !per[r.id]);
    const fromRecs = isRecords(doc);
    const unknown = rows.filter((r) => (fromRecs ? !r.known : !r.reads));
    if (unknown.length && !fromRecs) notes.push(`${plural(unknown.length, 'sensor')} ${unknown.length === 1 ? 'does' : 'do'} not say what ${unknown.length === 1 ? 'it measures' : 'they measure'}; ${unknown.length === 1 ? 'it comes' : 'they come'} in as a plain reading with no alerts.`);
    return { ok: true, rows, per, withS, bare, unlinked, stray, pipes, unknown, notes, fromList: !cells && !fromRecs, fromRecords: fromRecs };
  }

  /* the two readers' results as the model the console reads */
  function build(eq, sn, meta) {
    const m = clone(eq.model); const mt = meta || {};
    m.name = String(mt.name || '').trim() || (BUILT_IN ? BUILT_IN.name : 'Plant'); m.type = mt.type || (BUILT_IN ? BUILT_IN.type : 'STP');
    m.equipment.forEach((e) => { e.sensors = arr(sn && sn.ok ? sn.per[e.id] : []).map((s) => ({ tag: s.tag, widget: s.widget, reading: s.reading })); });
    /* a sensor the library has no reading for keeps its own name (Bar Screen 25%, Under Maintenance) instead of its abbreviation */
    if (sn && sn.ok && W.SCADA_SENSOR_MAP) sn.rows.forEach((s) => { if (s.reads && !W.SCADA_SENSOR_MAP[s.tag]) W.SCADA_SENSOR_MAP[s.tag] = s.reads; });
    m.ingested = true; return m;
  }
  /* the structure was read from the built-in drawing: keep what still exists, and list the rest as not placed */
  function fitStructure(model) {
    if (!W.V7_STRUCTURE) return; if (!model) { if (STRUCT0) W.V7_STRUCTURE[PLANT] = clone(STRUCT0); return; }
    const has = new Set(model.equipment.map((e) => e.id)); const s0 = STRUCT0 ? clone(STRUCT0) : { state: 'none', ups: [], cgs: [], unplaced: [] };
    const ups = s0.ups.filter((u) => has.has(u.id)).map((u) => ({ ...u, members: arr(u.members).filter((x) => has.has(x.eqId)) }));
    const cgs = s0.cgs.map((c) => ({ ...c, memberIds: arr(c.memberIds).filter((id) => has.has(id)) })).filter((c) => c.memberIds.length > 1);
    const placed = new Set(); ups.forEach((u) => { placed.add(u.id); u.members.forEach((x) => placed.add(x.eqId)); });
    W.V7_STRUCTURE[PLANT] = { ...s0, state: ups.length ? s0.state : 'none', ups, cgs, unplaced: model.equipment.map((e) => e.id).filter((id) => !placed.has(id)) };
  }
  function put(model) {
    if (!W.SCADA_SAMPLES) return; if (model) W.SCADA_SAMPLES[PLANT] = model; else if (BUILT_IN) W.SCADA_SAMPLES[PLANT] = clone(BUILT_IN); fitStructure(model);
    /* which library each unit-process node is offered, and one unit process per such node in the structure */
    if (model && W.V7NODES) W.V7NODES.apply(W.SCADA_SAMPLES[PLANT], W.V7_STRUCTURE && W.V7_STRUCTURE[PLANT]);
  }
  function read(eqText, snText, meta) {
    const p = parse(eqText); if (!p.ok) return { ok: false, step: 1, error: p.error };
    const eq = equipment(p.doc); if (!eq.ok) return { ok: false, step: 1, error: eq.error };
    let sdoc = eq.records || eq.src; if (String(snText || '').trim()) { const q = parse(snText); if (!q.ok) return { ok: false, step: 2, eq, error: q.error }; sdoc = q.doc; }
    const sn = sensors(sdoc, eq); if (!sn.ok) return { ok: false, step: 2, eq, error: sn.error };
    return { ok: true, eq, sn, model: build(eq, sn, meta) };
  }
  let SESSION = null;   /* a plant graph loaded when the browser had no room to keep it: it lasts until the page is reloaded */
  const kept = () => { try { const o = JSON.parse(W.localStorage.getItem(KEY) || 'null'); return o && (o.model || o.eq) ? o : SESSION; } catch (e) { return SESSION; } };
  const namesOf = (sn) => { const o = {}; arr(sn && sn.rows).forEach((s) => { if (s.reads) o[s.tag] = s.reads; }); return o; };
  const putNames = (names) => { if (W.SCADA_SENSOR_MAP) Object.keys(names || {}).forEach((t) => { if (!W.SCADA_SENSOR_MAP[t]) W.SCADA_SENSOR_MAP[t] = names[t]; }); };
  function use(eqText, snText, meta) {
    const r = read(eqText, snText, meta); if (!r.ok) return r;
    /* what is kept is the small model the console reads (equipment, sensors, pipes), never the files themselves. If the
       browser still has no room, the plant graph is loaded for this session only. */
    const save = { model: r.model, names: namesOf(r.sn), at: Date.now() }; SESSION = null;
    try { W.localStorage.removeItem(KEY); W.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { SESSION = { ...save, session: true }; r.session = true; }
    put(r.model); return r;
  }
  function clear() { SESSION = null; try { W.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } put(null); }
  function applyKept() {
    const k = kept(); if (!k) return false;
    if (k.model && Array.isArray(k.model.equipment) && k.model.equipment.length) { putNames(k.names); put(clone(k.model)); return true; }
    const r = k.eq ? read(k.eq, k.sn, k.meta) : { ok: false }; if (!r.ok) { clear(); return false; } put(r.model); return true;
  }
  const sampleText = () => (W.SCADA_LAYOUTS && W.SCADA_LAYOUTS[PLANT] ? JSON.stringify(W.SCADA_LAYOUTS[PLANT], null, 1) : '');

  W.V7INGEST = { parse, equipment, sensors, build, read, use, clear, kept, sampleText, applyKept, PLANT };
  applyKept();
}());
