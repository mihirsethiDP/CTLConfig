/* v7/3 · ingest73.js — two readers for a plant-graph JSON, so the whole flow can be tested on any export.
   READER 1, equipment(doc): finds every piece of equipment drawn and says which database equipment type it is. The rule is the
     console's own (window.detectDbType): the type stored on the node wins over the shape it was drawn with; a code the database
     does not have is still equipment, shown as "not in the database". Tags come from labels, as scadaFromLayout() makes them.
   READER 2, sensors(doc, eq): finds the sensors on that equipment. From a plant graph it follows each dashed link from a widget
     to the equipment it reads; from a plain list ([{ equipmentId | equipmentTag | equipmentLabel, widget, code, reading }]) it
     matches each row to a piece of equipment reader 1 found. It says what each sensor reads (window.READINGS) and lists what it
     could not place.
   build(eq, sn, meta) joins the two into the model the console reads; use(text, text, meta) keeps it in localStorage
   ('ctl73.ingest') and makes it the plant graph of the plant being set up (DigitalPaani); clear() goes back to the built-in one.
   This file runs before the core boots, so a kept plant graph is already in place when the story is seeded or restored.
   window.V7INGEST = { parse, equipment, sensors, build, read, use, clear, kept, sampleText, applyKept, PLANT } */
(function () {
  'use strict';
  const W = window; const KEY = 'ctl73.ingest'; const PLANT = 'digitalpaani';
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
  const cellsOf = (doc) => { const d = doc && (doc.layout || doc); const c = Array.isArray(doc) ? doc : d && d.cells; return Array.isArray(c) && c.length && c.every((x) => x && typeof x === 'object') && c.some((x) => x.type && x.id) ? c : null; };

  /* READER 1 */
  function equipment(doc) {
    const cells0 = cellsOf(doc);
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
    const rows = model.equipment.map((e) => {
      const det = W.detectDbType(e); const known = !det.notInDb;
      return { id: e.id, cell: e.cell, label: e.label || '(no name)', tag: e.tag, code: e.code, dbType: det.dbType, typeName: known ? det.type : null, known, drawnAs: det.drawnAs || null, noName: !e.label };
    });
    if (!rows.length) return { ok: false, error: 'This plant graph has no equipment on it.' };
    const by = {}; const types = [];
    rows.forEach((r) => { let g = by[r.dbType]; if (!g) { g = by[r.dbType] = { code: r.dbType, name: r.typeName, known: r.known, count: 0, tags: [] }; types.push(g); } g.count++; g.tags.push(r.tag); });
    types.sort((a, b) => (a.known === b.known ? b.count - a.count || String(a.name || a.code).localeCompare(String(b.name || b.code)) : a.known ? 1 : -1));
    const other = { widgets: 0, drawing: 0, ignored: 0, pipes: cells.filter((c) => c.type === 'Pipe').length, links: cells.filter((c) => c.type === 'standard.Link').length };
    cells.forEach((c) => { if (isLine(c)) return; const row = db(c.equipmentType || c.type); const k = row ? row.kind : 'equipment'; if (k === 'widget') other.widgets++; else if (k === 'drawing') other.drawing++; else if (k === 'ignore') other.ignored++; });
    const nameless = rows.filter((r) => r.noName).length; if (nameless) notes.push(`${plural(nameless, 'piece')} of equipment ${nameless === 1 ? 'has' : 'have'} no name on the drawing.`);
    return { ok: true, rows, types, unknown: types.filter((t) => !t.known), other, notes, cells: cells.length, site: model.site, drawn: model.drawn, version: model.fromLayout && model.fromLayout.version, model, src };
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
  function sensors(doc, eq) {
    if (!eq || !eq.ok) return { ok: false, error: 'Read the equipment first: sensors are found on the equipment it lists.' };
    const rows = []; const unlinked = []; const stray = []; const notes = [];
    const cells = cellsOf(doc);
    if (cells) {
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
    const unknown = rows.filter((r) => !r.reads);
    if (unknown.length) notes.push(`${plural(unknown.length, 'sensor')} ${unknown.length === 1 ? 'does' : 'do'} not say what ${unknown.length === 1 ? 'it measures' : 'they measure'}; ${unknown.length === 1 ? 'it comes' : 'they come'} in as a plain reading with no alerts.`);
    return { ok: true, rows, per, withS, bare, unlinked, stray, unknown, notes, fromList: !cells };
  }

  /* the two readers' results as the model the console reads */
  function build(eq, sn, meta) {
    const m = clone(eq.model); const mt = meta || {};
    m.name = String(mt.name || '').trim() || (BUILT_IN ? BUILT_IN.name : 'Plant'); m.type = mt.type || (BUILT_IN ? BUILT_IN.type : 'STP');
    m.equipment.forEach((e) => { e.sensors = arr(sn && sn.ok ? sn.per[e.id] : []).map((s) => ({ tag: s.tag, widget: s.widget, reading: s.reading })); });
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
  function put(model) { if (!W.SCADA_SAMPLES) return; if (model) W.SCADA_SAMPLES[PLANT] = model; else if (BUILT_IN) W.SCADA_SAMPLES[PLANT] = clone(BUILT_IN); fitStructure(model); }
  function read(eqText, snText, meta) {
    const p = parse(eqText); if (!p.ok) return { ok: false, step: 1, error: p.error };
    const eq = equipment(p.doc); if (!eq.ok) return { ok: false, step: 1, error: eq.error };
    let sdoc = eq.src; if (String(snText || '').trim()) { const q = parse(snText); if (!q.ok) return { ok: false, step: 2, eq, error: q.error }; sdoc = q.doc; }
    const sn = sensors(sdoc, eq); if (!sn.ok) return { ok: false, step: 2, eq, error: sn.error };
    return { ok: true, eq, sn, model: build(eq, sn, meta) };
  }
  const kept = () => { try { const o = JSON.parse(W.localStorage.getItem(KEY) || 'null'); return o && o.eq ? o : null; } catch (e) { return null; } };
  function use(eqText, snText, meta) {
    const r = read(eqText, snText, meta); if (!r.ok) return r;
    const save = { eq: JSON.stringify(parse(eqText).doc), sn: String(snText || '').trim() ? JSON.stringify(parse(snText).doc) : '', meta: { name: r.model.name, type: r.model.type }, at: Date.now() };
    try { W.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { return { ok: false, step: 3, error: 'This file is too large to keep in the browser. It was not loaded.' }; }
    put(r.model); return r;
  }
  function clear() { try { W.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } put(null); }
  function applyKept() { const k = kept(); if (!k) return false; const r = read(k.eq, k.sn, k.meta); if (!r.ok) { clear(); return false; } put(r.model); return true; }
  const sampleText = () => (W.SCADA_LAYOUTS && W.SCADA_LAYOUTS[PLANT] ? JSON.stringify(W.SCADA_LAYOUTS[PLANT], null, 1) : '');

  W.V7INGEST = { parse, equipment, sensors, build, read, use, clear, kept, sampleText, applyKept, PLANT };
  applyKept();
}());
