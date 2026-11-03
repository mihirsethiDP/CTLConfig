#!/usr/bin/env node
/* v7/2 · tests/library72.test.js — headless test of the library: templates built from the shipped library (equipment types
   without a unit process on them, unit-process types, plant types, single-use), their own versions and history, the seed's
   20 Oct publish, Downstream before and after an edit, the four publish kinds (Patch, Minor, Major, Forced) and what each
   does at the plants, pins, the review-queue drafts a Major change makes, and determinism.
   Node only, no dependencies. Runs in two parts, each in its own process:
     main      the whole v7/2 stack through tests/load72.js
     --boot    a fresh boot that makes the same edits, for the determinism checks
   Usage: TZ=Asia/Calcutta node tests/library72.test.js [-v]     Exit code 0 = pass. */
'use strict';
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const SELF = __filename;
const MODE = process.argv.includes('--boot') ? '--boot' : 'main';
const VERBOSE = process.argv.includes('-v');
const KEYS = ['digitalpaani', 'vedanta', 'manesar', 'bawal'];
const results = []; let fails = 0;
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail: detail == null ? undefined : String(detail) }); if (!ok) fails++; }
const J = (x) => JSON.stringify(x);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const emit = (o) => process.stdout.write('@@' + JSON.stringify(o) + '\n');
function child(args, env) {
  const r = spawnSync(process.execPath, [SELF, ...args], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { TZ: 'Asia/Calcutta' }, env || {}) });
  const line = String(r.stdout || '').split(/\r?\n/).filter((l) => l.startsWith('@@'))[0];
  if (!line) return { error: `${args.join(' ')} exited ${r.status}: ${String(r.stderr || r.stdout || '').slice(0, 600)}` };
  try { return JSON.parse(line.slice(2)); } catch (e) { return { error: 'bad output: ' + line.slice(0, 200) }; }
}
/* the same edits in every process, then fingerprints of what they produce */
function edits(V) {
  V.editTemplate('tpl_up_activated-sludge_mlss-low', { band: 'minor', rule: { kind: 'const', value: 2200 } });
  const ds = V.downstream('tpl_up_activated-sludge_mlss-low');
  V.publishTemplate('tpl_up_activated-sludge_mlss-low', { note: 'Plants run well down to 2,200; 2,000 opened Issues too late' });
  V.editTemplate('tpl_up_activated-sludge_do-low', { band: 'emergency', rule: { kind: 'const', value: 0.8 } });
  return { ds, ds2: V.downstream('tpl_up_activated-sludge_do-low') };
}
const prints = (V, e) => ({ templates: sha(J(V.templates({}))), deviations: sha(J(V.deviations())), held: sha(J(V.S.held)), downstream: sha(J([e.ds, e.ds2])), state: sha(J(V.S)) });

if (MODE === '--boot') {
  const L = require('./load72.js'); const V = L.V7;
  const seed = { templates: sha(J(V.templates({}))), held: sha(J(V.S.held)), state: sha(J(V.S)) };
  emit({ seed, after: prints(V, edits(V)), errors: L.errors.map((x) => x.file) });
  process.exit(0);
}

const t0 = Date.now();
const L = require('./load72.js'); const V = L.V7; const __ = V && V.__; const C = L.CTL;
check('load', 'the v7/2 stack loads and boots with the library file', !!V && L.loaded.includes('core72-library.js') && !L.errors.length, L.errors.map((e) => `${e.file}: ${e.error.slice(0, 200)}`).join(' | '));
if (!V || !L.loaded.includes('core72-library.js')) report();
const BANDS = ['caution', 'minor', 'major', 'emergency'];
const seedJson = J(V.S);
const tpl = (id) => V.template(id);
const libLines = () => V.activity({ kind: 'library' }).filter((a) => !a.plant);
const actLast = (k) => (V.activity({ plant: k, limit: 1 })[0] || {}).text;
const rec = (pred) => V.S.overrides.find((o) => o.plant === 'manesar' && o.target && pred(o.target, o));

/* ── 1. templates (V72-2) ── */
{
  const all = V.templates({}); const ids = new Set(all.map((t) => t.id));
  const missing = []; KEYS.forEach((k) => __.dOf(k).alerts.forEach((a) => { if (!a.templateId || !ids.has(a.templateId)) missing.push(`${k}:${a.id}`); }));
  check('templates', 'V72-2 · every Trigger at every plant names a template that templates() lists', missing.length === 0 && KEYS.some((k) => __.dOf(k).alerts.length), missing.join(', '));
  const anchors = V.ANCHOR_CODES; const eqT = all.filter((t) => t.owner.kind === 'eqType' && !t.singleUse);
  check('templates', 'V72-2 · equipment-type templates exist only for the types with no unit process on them (27 of 56)', eqT.length > 0 && eqT.every((t) => !anchors.includes(t.owner.code)) && new Set(eqT.map((t) => t.owner.code)).size <= 27 && anchors.length === 29, J([...new Set(eqT.map((t) => t.owner.code))].filter((c) => anchors.includes(c))));
  const bad = [];
  V.UP_TYPES.forEach((u) => {
    /* a unit-process type named like its content-from type took that set's place in v6's library: its copy is the content */
    const from = C.S.lib.standardSets.find((s) => s.type === (window.CATALOGUE_BY_CODE[u.contentFrom] || {}).type && !s.upType) || (u.name === (window.CATALOGUE_BY_CODE[u.contentFrom] || {}).type ? C.S.lib.standardSets.find((s) => s.upType === u.id) : null); if (!from) { bad.push(`${u.id}: no content`); return; }
    const mine = all.filter((t) => t.owner.kind === 'upType' && t.owner.id === u.id);
    from.alerts.forEach((a) => {
      const t = mine.find((x) => x.kind === 'trigger' && x.name === a.name); if (!t || t.reading !== a.sensorKind || t.dir !== a.direction) { bad.push(`${u.id}:${a.name}`); return; }
      BANDS.forEach((b) => { const v = a.limits[b]; const r = t.rules[b]; const got = !r ? null : r.rule.kind === 'const' ? r.rule.value : r.rule.param === 'tankHeight' ? Math.round(r.rule.factor * 100 * 1e4) / 1e4 : 'expr'; if (!(v == null ? got == null : got === v)) bad.push(`${u.id}:${a.name}:${b}`); });
    });
    from.schedules.forEach((x) => { const t = mine.find((y) => y.kind === 'task' && y.name === x.name); const ev = C.cadenceOf(x); if (!t || J(t.every) !== J(ev)) { if (u.id === 'clarification') return; bad.push(`${u.id}:${x.name}`); } });
  });
  check('templates', 'V72-2 · each unit-process type\'s templates carry the readings, directions, limits and cadences of its content-from type (a tank-height rule resolves to the same %)', bad.length === 0, bad.slice(0, 8).join(', '));
  const lv = tpl('tpl_up_equalisation_level-high'); const mc = tpl('tpl_BLW_motor-current-high'); const fi = tpl('tpl_BLW_clean-intake-filter');
  check('templates', 'limit rules: Level high on a tank the survey measures is 85% / 95% of tank height; Motor current high on a Blower 100% / 105% / 115% of full-load current; the intake-filter job 95% / 85%', lv.rules.caution.text === '85% of tank height' && lv.rules.major.text === '95% of tank height' && mc.rules.caution.text === '100% of full-load current' && mc.rules.minor.text === '105% of full-load current' && mc.rules.major.text === '115% of full-load current' && !mc.rules.emergency && fi.condition.doWhen.text === '95% of full-load current' && fi.condition.doneWhen.text === '85% of full-load current', J([lv.rules.caution.text, mc.rules.minor.text, fi.condition && fi.condition.doWhen.text]));
  const t2 = tpl('tpl_up_activated-sludge_do-low');
  check('templates', 'a template page: "Trigger template · v1", listed under its unit-process type, its uses at the plants', t2.chipText === 'Trigger template · v1' && t2.listedUnder.text === 'Listed under: Activated sludge' && t2.listedUnder.href === '#/library/up-types/activated-sludge' && t2.uses.some((u) => u.kind === 'trigger' && u.alertId === 'a_do_at2') && t2.subject === 'up', J([t2.chipText, t2.listedUnder]));
  const rounds = all.filter((t) => t.owner.kind === 'plantType');
  check('templates', 'plant rounds are plant-type templates (STP 8 · ETP 7 · WTP 5) and Manesar\'s rounds follow them', rounds.length === 20 && __.dOf('manesar').schedules.filter((s) => s.subject.kind === 'plant').every((s) => /^tpl_PLANT_STP_/.test(s.templateId)), rounds.length);
  check('templates', 'ids by slug, no shared-counter draw: tpl_<CODE>_…, tpl_up_<type>_…, tpl_PLANT_<type>_…, tpl_single_<plant>_…', all.every((t) => /^tpl_(up_[a-z-]+_[a-z0-9-]+|PLANT_(STP|ETP|WTP)_[a-z0-9-]+|single_[a-z]+_[A-Za-z0-9_]+|[A-Z_0-9]+_[a-z0-9-]+)$/.test(t.id)) && V.S.seq === 202, all.filter((t) => !/^tpl_/.test(t.id)).map((t) => t.id).join(','));
}

/* ── 2. the library pages (V72-7) ── */
{
  const tt = V.templates({}); const counts = { plantTypes: V.plantTypes().length, upTypes: V.upTypes().length, eqTypes: V.libTypes().length, templates: tt.length, trigger: tt.filter((t) => t.kind === 'trigger').length, task: tt.filter((t) => t.kind === 'task').length, conditions: V.conditions().length, flows: V.flows().length, rootCauses: V.rootCauses().length };
  check('pages', 'V72-7 · the seven collections are counted by their functions: plant types 3 · unit-process types 27 · equipment types 56 · templates = trigger + task · conditions · flows · root causes', counts.plantTypes === 3 && counts.upTypes === 27 && counts.eqTypes === 56 && counts.templates === counts.trigger + counts.task && counts.conditions > 0 && counts.flows > 0 && counts.rootCauses > 0, J(counts));
  const an = V.libTypes().filter((t) => t.anchor);
  check('pages', 'V72-7 · every equipment type with a unit process on it has the banner and links to its unit-process types; it carries no content of its own', an.length === 29 && an.every((t) => { const x = V.libType(t.code); return /^Every .+ in the plant graph is a unit process\. Its readings, Triggers, Tasks and Issues are on the unit-process type: .+\.$/.test(x.banner) && x.movedToTypes.length > 0 && x.movedToTypes.every((m) => /^#\/library\/up-types\//.test(m.href)) && !x.alerts.length && !x.schedules.length; }), an.map((t) => `${t.code}:${(V.libType(t.code).movedTo || []).length}`).filter((x) => /:0$/.test(x)).join(','));
  const mb = V.libType('MBBR');
  check('pages', 'MBBR: "Every MBBR in the plant graph is a unit process. Its readings, Triggers, Tasks and Issues are on the unit-process type: Moving bed bioreactor."', mb.banner === 'Every MBBR in the plant graph is a unit process. Its readings, Triggers, Tasks and Issues are on the unit-process type: Moving bed bioreactor.', mb.banner);
  const mbbr = V.upTypeView('mbbr'); const v6 = C.S.lib.standardSets.find((s) => s.type === 'MBBR' && !s.upType);
  check('pages', 'V72-7 · Moving bed bioreactor lists the Task templates and Issue types v7/1 shows on MBBR', J(mbbr.schedules.map((t) => t.name)) === J(v6.schedules.map((x) => x.name)) && J(mbbr.issues.map((i) => i.id)) === J(V.issueTypes('MBBR').map((i) => i.id)) && mbbr.issues.length === 15 && mbbr.chipText === 'Unit-process type · v1', `${mbbr.schedules.length}/${v6.schedules.length} · ${mbbr.issues.length}`);
  const blw = V.libType('BLW'); const card = blw.readings.find((r) => r.name === 'Motor current'); const d0 = card && card.dirs[0];
  check('pages', 'Blower: "Equipment type · v1"; the Motor current card "Motor current high v1" reads Caution above 100% · Minor above 105% · Major above 115% of full-load current', blw.chipText === 'Equipment type · v1' && d0 && d0.title === 'Motor current high v1' && d0.rulesText === 'Caution above 100% · Minor above 105% · Major above 115% of full-load current' && d0.rules.caution.text === '100% of full-load current', d0 && d0.rulesText);
  const ra = d0 ? d0.resolvesAt.map((x) => x.text) : [];
  check('pages', 'its Resolves at lines: Manesar BL-1 40.0 / 42.0 / 46.0 A (22 kW), keeps its own 44 / 48 A / none, Vedanta BL-1 20.0 / 21.0 / 23.0 A (11 kW), DigitalPaani needs a Motor current sensor (5 blowers)', ra.includes('Manesar STP · BL-1: 40.0 / 42.0 / 46.0 A (22 kW motor)') && ra.includes('Manesar STP · BL-1 keeps its own 44 / 48 A / none (Override)') && ra.includes('Vedanta ETP · BL-1: 20.0 / 21.0 / 23.0 A (11 kW motor)') && ra.includes('DigitalPaani: needs a Motor current sensor (5 blowers)'), J(ra));
  const ag = V.libType('OS_TANK_AG').readings.find((r) => r.name === 'Motor current').dirs[0];
  check('pages', 'Agitator: "Motor current high v1" Minor above 24 A, flagged "This scales with the plant. Use a design parameter?"', ag.rulesText === 'Minor above 24 A' && ag.flagText === 'This scales with the plant. Use a design parameter?' && ag.chip.text === 'Library · Motor current high v1', J([ag.rulesText, ag.flagText]));
  const cond = V.condition('dissolved-oxygen-below');
  check('pages', 'a Condition lists the templates whose limit rule sets its threshold', cond && cond.usedBy > 0 && cond.uses.some((u) => u.templateId === 'tpl_up_activated-sludge_do-low' && u.band === 'minor' && u.ruleText === '2.0 mg/L'), cond && cond.usedByText);
}

/* ── 3. the seed's 20 Oct publish (V72-8) ── */
{
  const t = tpl('tpl_up_clarification_sludge-blanket-high');
  check('seed', 'V72-8 · Sludge blanket high (Secondary clarification) is v2, persistence 15, with history v1 (5) and v2 (15, Minor, Tue 20 Oct 11:00, Satyadev Singh)', t.v === 2 && t.hold === 15 && t.history.length === 2 && t.history[0].v === 1 && __.S.lib.tplHistory[t.id][0].body.hold === 5 && t.history[1].kind === 'minor' && V.fmt(t.history[1].at) === 'Tue 20 Oct, 11:00' && t.history[1].by === 'Satyadev Singh' && t.history[1].text === 'v2 · 20 Oct 2026 · Minor · persistence 5 → 15 min · Blanket readings bounce while the scraper passes; 15 min stops false starts', J(t.history.map((h) => h.text)));
  const typeKeys = [...V.libTypes().map((x) => x.typeKey), ...V.upTypes().map((u) => `up:${u.id}`), ...['STP', 'ETP', 'WTP'].map((p) => `plant:${p}`)];
  check('seed', 'V72-8 · every equipment type, unit-process type and plant type is v1', typeKeys.every((k) => V.typeVersion(k) === 1) && V.libVersion('CLARIFIER') === 1 && V.upTypes().every((u) => u.version === 1), typeKeys.filter((k) => V.typeVersion(k) !== 1).join(','));
  const ll = libLines().filter((a) => /^Published/.test(a.text));
  check('seed', 'V72-8 · All Plants Activity has exactly one publish line: "Published Sludge blanket high v2 (Minor): persistence 5 → 15 min. Blanket readings …"', ll.length === 1 && ll[0].text === 'Published Sludge blanket high v2 (Minor): persistence 5 → 15 min. Blanket readings bounce while the scraper passes; 15 min stops false starts' && V.fmt(ll[0].at) === 'Tue 20 Oct, 11:00', J(ll.map((x) => x.text)));
  check('seed', 'V72-8 · Manesar\'s Activity has none', !V.activity({ plant: 'manesar' }).some((a) => /Sludge blanket high v2|Clarifier Tank v2|Published/.test(a.text)));
  const tm = V.timingOf('manesar', 'a_blanket', 'hold'); const ch = V.libChanges({ templateId: t.id });
  check('seed', 'Manesar keeps 30 min over the library\'s 15 (base 5): Base moved; the change record names it', tm.value === 30 && tm.resolved === 15 && tm.chipText === 'Base moved' && ch.length === 1 && ch[0].kind === 'minor' && ch[0].reached.baseMoved.length === 1, J([tm.value, tm.resolved, tm.chipText, ch.length]));
  check('seed', 'no pins, no Forced change, no drafts, no Major holds at seed', V.pins({}).length === 0 && !Object.keys(__.S.lib.forced || {}).length && !Object.keys(__.S.lib.drafts || {}).length && !(V.S.majorHolds || []).length);
  check('seed', 'Chapter 1 · DO low\'s Downstream before an edit: Field · Follow · Override · Pinned · Frozen', (() => { const b = V.downstream('tpl_up_activated-sludge_do-low').before.perField.map((r) => [r.label, r.counts.follow, r.counts.override, r.counts.pinned, r.counts.frozen]); return J(b) === J([['Minor', 1, 0, 0, 1], ['Major', 1, 0, 0, 1], ['Emergency', 1, 1, 0, 1], ['Persistence · must hold for', 0, 0, 0, 1], ['Clearing · must clear for', 0, 0, 0, 1]]); })(), J(V.downstream('tpl_up_activated-sludge_do-low').before.perField.map((r) => [r.label, r.counts])));
  const fz = V.downstream('tpl_up_activated-sludge_do-low').before.perField[0];
  check('seed', 'its Frozen column names "DO low · AT-2 (1 open Issue)"', J(fz.frozenText) === J(['DO low · AT-2 (1 open Issue)']), J(fz.frozenText));
}

/* ── 4. a Minor change (V72-93, V72-94) ── */
V.reset();
{
  const id = 'tpl_up_activated-sludge_mlss-low';
  const e = V.editTemplate(id, { band: 'minor', rule: { kind: 'const', value: 2200 } }); const ds = V.downstream(id); const f = ds.fields[0];
  check('minor', 'V72-93 · Minor 2,000 → 2,200: totals update 1, base moved 1, clears 0, pinned 0, frozen 0; suggested Minor, allowed Minor and Major', e.ok && ds.totals.update === 1 && ds.totals.baseMoved === 1 && ds.totals.clears === 0 && ds.totals.pinned === 0 && ds.totals.frozen === 0 && ds.suggestedKind === 'minor' && J(ds.allowedKinds) === J(['minor', 'major']), J(ds.totals));
  check('minor', 'Downstream reads "Minor below: 2,000 → 2,200 mg/L"; "1 plant will update" → "Manesar STP · MLSS-AT2: 2,000 → 2,200 mg/L"; "1 plant will show base moved" → "Manesar STP · MLSS-AT1 keeps 2,500 (Override · Migrated)"', f.heading === 'Minor below: 2,000 → 2,200 mg/L' && J(f.groups.find((g) => g.key === 'update')) === J({ key: 'update', head: '1 plant will update', items: ['Manesar STP · MLSS-AT2: 2,000 → 2,200 mg/L'], why: ['not bound yet: proposed in the bindings pass'] }) && J(f.groups.find((g) => g.key === 'baseMoved').items) === J(['Manesar STP · MLSS-AT1 keeps 2,500 (Override · Migrated)']) && f.groups.find((g) => g.key === 'baseMoved').head === '1 plant will show base moved', J(f.groups));
  check('minor', '"0 pinned · hold at v1"; "Resolves to 2,200 mg/L at every plant (a constant)"; "A plant appears twice when its instances differ."; "Version: Minor (suggested)"; "Publish v2 to 1 plant"', f.groups.some((g) => g.head === '0 pinned · hold at v1') && ds.resolves[0].text === 'Resolves to 2,200 mg/L at every plant (a constant)' && ds.lines.includes('A plant appears twice when its instances differ.') && ds.versionText === 'Version: Minor (suggested)' && ds.publishLabel === 'Publish v2 to 1 plant' && ds.kindTitles.patch === 'This change is Minor: a smaller kind would hide it.', J([ds.versionText, ds.publishLabel]));
  const nn = V.publishTemplate(id, {}); const pk = V.publishTemplate(id, { kind: 'patch', note: 'x' });
  check('minor', 'publishing needs a change note, and refuses a kind below the suggestion', !nn.ok && nn.error === 'Write a change note.' && !pk.ok && pk.error === "This change is Minor: it can't be published as Patch.", `${nn.error} | ${pk.error}`);
  const m0 = V.activity({ plant: 'manesar' }).length;
  const p = V.publishTemplate(id, { note: 'Plants run well down to 2,200; 2,000 opened Issues too late' });
  const a2 = V.zoneInfo('manesar', 'at2_mlss', 'below').perBand.minor; const a1 = rec((t) => t.kind === 'zone' && t.sensorId === 'at1_mlss' && t.band === 'minor');
  check('minor', 'V72-94 · published v2: toast "Published MLSS low v2 to 1 plant · 1 base moved"; MLSS-AT2 Minor 2,200 "Library · MLSS low v2"', p.ok && p.toast === 'Published MLSS low v2 to 1 plant · 1 base moved' && a2.value === 2200 && a2.chipText === 'Library · MLSS low v2' && V.tplVersion(id) === 2, p.error || J([p.toast, a2.value, a2.chipText]));
  check('minor', 'V72-94 · the MLSS-AT1 override is Base moved: "Library changed 2,000 → 2,200 since you overrode it"', V.ovState(a1) === 'basemoved' && V.zoneInfo('manesar', 'at1_mlss', 'below').perBand.minor.chip.sub === 'Library changed 2,000 → 2,200 since you overrode it');
  check('minor', 'V72-94 · All Plants Activity gains one line ("Published MLSS low v2 (Minor): Minor below 2,000 → 2,200 mg/L. Plants run well …") and Manesar\'s Activity none', libLines()[0].text === 'Published MLSS low v2 (Minor): Minor below 2,000 → 2,200 mg/L. Plants run well down to 2,200; 2,000 opened Issues too late' && libLines().filter((a) => /^Published/.test(a.text)).length === 2 && V.activity({ plant: 'manesar' }).length === m0, libLines()[0].text);
  check('minor', 'the change is recorded with what it reached; the v6 set follows', V.libChanges({ templateId: id })[0].reached.baseMoved.includes(a1.id) && C.S.lib.standardSets.find((s) => s.upType === 'activated-sludge').alerts.find((a) => a.name === 'MLSS low').limits.minor === 2200);
}

/* ── 5. a Minor change equal to an override clears it (V72-95) ── */
V.reset();
{
  const id = 'tpl_up_activated-sludge_mlss-low';
  V.editTemplate(id, { band: 'minor', rule: { kind: 'const', value: 2500 } }); const ds = V.downstream(id); const g = ds.fields[0].groups.find((x) => x.key === 'clears');
  check('clears', 'V72-95 · Downstream reads "1 of them already equals 2,500 mg/L: it will clear"', g && g.head === '1 of them already equals 2,500 mg/L: it will clear' && ds.totals.clears === 1, g && g.head);
  const a1 = rec((t) => t.kind === 'zone' && t.sensorId === 'at1_mlss' && t.band === 'minor'); const p = V.publishTemplate(id, { note: 'A higher floor' });
  check('clears', 'V72-95 · publishing ends that override as cleared: "Cleared by MLSS low v2: the library now uses 2,500 mg/L"', p.ok && a1.status === 'cleared' && a1.endedNote === 'Cleared by MLSS low v2: the library now uses 2,500 mg/L' && V.zoneInfo('manesar', 'at1_mlss', 'below').perBand.minor.source === 'library', `${a1.status} ${a1.endedNote}`);
}

/* ── 6. a Forced change (V72-96) ── */
V.reset();
{
  const id = 'tpl_up_activated-sludge_do-low';
  V.editTemplate(id, { band: 'emergency', rule: { kind: 'const', value: 0.8 } }); const dv = V.templateDraft(id); const ds = V.downstream(id); const f = ds.fields[0];
  check('forced', 'V72-96 · an Emergency change suggests Forced, the only kind allowed; "Why is this forced?" is needed', dv.suggestedKind === 'forced' && J(dv.allowedKinds) === J(['forced']) && ds.needsReason && ds.kindTitles.minor === 'This change is Forced: a smaller kind would hide it.' && ds.kindTitles.forced === null, J(dv.allowedKinds));
  check('forced', 'Downstream: "1 plant will update" (DO-AT2 0.5 → 0.8 mg/L), "1 override suspended: kept, not applied; they return when lifted" (DO-AT1), "1 frozen · wait for open Issues" (DO low · AT-2), "Plant admins are told at Manesar STP."', J(f.groups.find((g) => g.key === 'update').items) === J(['Manesar STP · DO-AT2: 0.5 → 0.8 mg/L']) && f.groups.find((g) => g.key === 'suspended').head === '1 override suspended: kept, not applied; they return when lifted' && J(f.groups.find((g) => g.key === 'suspended').items) === J(['Manesar STP · DO-AT1']) && J(f.groups.find((g) => g.key === 'frozen').items) === J(['Manesar STP · DO low · AT-2']) && ds.lines.includes('Plant admins are told at Manesar STP.') && ds.publishLabel === 'Publish v2 to 1 plant', J(f.groups));
  const nr = V.publishTemplate(id, { note: 'A higher floor everywhere' });
  check('forced', 'V72-96 · publishing without a reason fails "A forced change needs a reason."', !nr.ok && nr.error === 'A forced change needs a reason.', nr.error);
  const doe = rec((t) => t.kind === 'zone' && t.sensorId === 'at1_do' && t.band === 'emergency');
  const p = V.publishTemplate(id, { note: 'A higher floor everywhere', reason: 'Low DO killed the biology at two plants' });
  check('forced', 'V72-96 · published: DO-AT1\'s Emergency override is suspended (kept, not ended), the zone reads 0.8 "Forced by library · DO low v2"', p.ok && doe.status === 'active' && !!doe.suspendedBy && V.zoneInfo('manesar', 'at1_do', 'below').bands.emergency === 0.8 && V.zoneInfo('manesar', 'at1_do', 'below').perBand.emergency.chipText === 'Forced by library · DO low v2', p.error || J(doe));
  check('forced', 'V72-96 · the held DO low · AT-2 (Issue open) is listed frozen and left untouched', __.termsFor('manesar', 'a_do_at2').bands.emergency === 0.5 && p.landed.totals.frozen === 1 && /1 frozen skipped/.test(p.toast), J(__.termsFor('manesar', 'a_do_at2').bands));
  check('forced', 'a notice in Manesar\'s Activity, to its plant admins: "Forced library change: DO low v2, Emergency below 0.5 → 0.8 mg/L. Your override on DO-AT1 is suspended …"', actLast('manesar') === 'Forced library change: DO low v2, Emergency below 0.5 → 0.8 mg/L. Your override on DO-AT1 is suspended and returns when the change is lifted. Plant admins told: Kishore Reddy and Swadesh Singh. Reason: Low DO killed the biology at two plants', actLast('manesar'));
  const lf = V.liftForced(id, { reason: 'The biology recovered' });
  check('forced', 'V72-96 · liftForced restores the override', lf.ok && !doe.suspendedBy && V.zoneInfo('manesar', 'at1_do', 'below').perBand.emergency.source === 'override' && V.zoneInfo('manesar', 'at1_do', 'below').bands.emergency == null, J(lf));
}

/* ── 7. a Major change (V72-97) ── */
V.reset();
{
  const id = 'tpl_up_activated-sludge_mlss-high';
  V.editTemplate(id, { band: 'caution', rule: { kind: 'const', value: 4000 } }); const dv = V.templateDraft(id); const ds = V.downstream(id);
  check('major', 'V72-97 · adding a band suggests Major', dv.suggestedKind === 'major' && J(dv.allowedKinds) === J(['major']) && ds.totals.drafts === 1 && ds.fields[0].groups.some((g) => g.head === '1 plant gets a new draft in the review queue; overrides are carried into it.'), J([dv.suggestedKind, ds.totals]));
  const p = V.publishTemplate(id, { note: 'Warn before the Minor band' }); const md = V.majorDrafts('manesar');
  check('major', 'V72-97 · publishing makes one review-queue draft per following plant; the Trigger stays on its old version', p.ok && md.length === 1 && md[0].templateId === id && md[0].v === 2 && md[0].fromV === 1 && V.versionAt('manesar', id) === 1 && V.alert('manesar', 'a_mlss_hi').templateVersion === 1 && __.termsFor('manesar', 'a_mlss_hi').bands.caution == null && V.majorDrafts('vedanta').length === 0, p.error || J(md));
  const ac = V.acceptMajorDraft('manesar', md[0].id);
  check('major', 'V72-97 · acceptMajorDraft moves it to v2 (Caution 4,000 mg/L)', ac.ok && V.versionAt('manesar', id) === 2 && __.termsFor('manesar', 'a_mlss_hi').bands.caution === 4000 && V.majorDrafts('manesar').length === 0, ac.error || J(__.termsFor('manesar', 'a_mlss_hi').bands));
}

/* ── 8. pins (V72-98) and the kinds allowed (V72-99) ── */
V.reset();
{
  const id = 'tpl_BLW_motor-current-high';
  const p0 = V.pin('vedanta', id, {}); const p1 = V.pin('vedanta', id, { reason: 'The blowers are due an overhaul; keep their limits until then' });
  check('pins', 'V72-98 · pin without a reason fails; with one it holds the plant at v1', !p0.ok && p0.error === 'Say why this plant should stay on v1.' && p1.ok && V.pins({ plant: 'vedanta' }).length === 1 && /^Pinned Motor current high to v1: /.test(actLast('vedanta')), `${p0.error} | ${p1.error || ''}`);
  V.editTemplate(id, { band: 'caution', rule: { kind: 'expr', factor: 0.95, param: 'fullLoadCurrent' } }); const ds = V.downstream(id);
  check('pins', 'V72-98 · a Minor change classes the pinned plant "pinned"', ds.fields[0].classes.pinned.some((x) => x.plant === 'vedanta') && ds.totals.pinned === 1 && ds.fields[0].groups.some((g) => g.head === '1 pinned · hold at v1'), J(ds.totals));
  V.publishTemplate(id, { note: 'Warn earlier' });
  check('pins', 'V72-98 · and it keeps the old value (20.0 A) while followers move (Manesar\'s base 38.0 A)', V.zoneInfo('vedanta', 'v_bl1_AMP', 'above').bands.caution === 20 && V.zoneInfo('manesar', 'bl1_amps', 'above').perBand.caution.resolved === 38);
  V.editTemplate(id, { band: 'emergency', rule: { kind: 'const', value: 50 } }); const ds2 = V.downstream(id);
  check('pins', 'V72-98 · a Forced change reaches it', ds2.kind === 'forced' && !ds2.fields[0].classes.pinned.length && ds2.fields[0].classes.update.some((x) => x.plant === 'vedanta') && ds2.reached.includes('vedanta'), J(ds2.reached));
  const pf = V.publishTemplate(id, { note: 'A ceiling for every blower', reason: 'Motor protection standard' });
  check('pins', 'published: Vedanta\'s Emergency 50 A in force on the pinned v2; its notice says nothing is sent while Commissioning', pf.ok && V.zoneInfo('vedanta', 'v_bl1_AMP', 'above').bands.emergency === 50 && / Commissioning: nothing is sent\. Reason: /.test(actLast('vedanta')), actLast('vedanta'));
  const un = V.unpin('vedanta', id);
  check('pins', 'Unpin: the plant follows the current version again', un.ok && V.zoneInfo('vedanta', 'v_bl1_AMP', 'above').bands.caution === 19 && V.pins({}).length === 0, J(V.zoneInfo('vedanta', 'v_bl1_AMP', 'above').bands));
  V.reset();
  const allowed = []; const t2 = 'tpl_up_activated-sludge_do-low';
  [[{ desc: 'Dissolved oxygen too low for the biology' }, 'patch'], [{ band: 'minor', rule: { kind: 'const', value: 1.9 } }, 'minor'], [{ band: 'caution', rule: { kind: 'const', value: 2.5 } }, 'major'], [{ band: 'emergency', rule: { kind: 'const', value: 0.7 } }, 'forced']].forEach(([chg, want]) => { V.editTemplate(t2, chg); const d = V.templateDraft(t2); allowed.push([want, d.suggestedKind, d.allowedKinds]); });
  const ORDER = ['patch', 'minor', 'major', 'forced'];
  check('kinds', 'V72-99 · wording → Patch, a value → Minor, a band added → Major, Emergency → Forced; allowedKinds never below the suggestion', allowed.every(([w, s, a]) => w === s && a.every((k) => ORDER.indexOf(k) >= ORDER.indexOf(s))) && J(allowed[0][2]) === J(['patch', 'minor', 'major']) && J(allowed[3][2]) === J(['forced']), J(allowed));
  const dd = V.discardTemplateDraft(t2);
  check('kinds', 'Discard draft: nothing reached any plant', dd.ok && !V.templateDraft(t2) && V.tplVersion(t2) === 1);
  V.editTemplate(t2, { band: 'minor', rule: { kind: 'const', value: 2 } });
  check('kinds', 'a change back to the published value leaves no draft', !V.templateDraft(t2));
  const bo = V.editTemplate(t2, { band: 'minor', rule: { kind: 'const', value: 0.4 } });
  check('kinds', 'the band order is checked where the rule resolves, naming the plant', !bo.ok && /^Manesar STP · DO-AT\d: /.test(bo.error), bo.error);
}

/* ── 9. single-use templates (V72-100) ── */
V.reset();
{
  const ids = ['s_hypo', 'w_sludge'].map((s) => __.schedRaw('manesar', s).templateId);
  const tt = ids.map(tpl); const recs = V.S.overrides.filter((o) => o.plant === 'manesar' && o.target && ['s_hypo', 'w_sludge'].includes(o.target.scheduleId));
  check('single', 'V72-100 · s_hypo and w_sludge follow single-use templates (tpl_single_manesar_…), with no ledger record', J(ids) === J(['tpl_single_manesar_s_hypo', 'tpl_single_manesar_w_sludge']) && tt.every((t) => t.singleUse && t.singleUse.plant === 'manesar') && recs.length === 0 && tt[0].name === 'Chemical refill' && tt[1].name === 'Sludge wasting', J(ids));
  check('single', 'they are listed under their equipment types (Dosing Pump, Pump), every week', tt[0].ownerName === 'Dosing Pump' && tt[1].ownerName === 'Pump' && tt[0].everyText === 'every week' && V.templates({ owner: 'D_PMP' }).some((t) => t.id === ids[0]), J([tt[0].ownerName, tt[1].ownerName, tt[0].everyText]));
}

/* ── 10. determinism (V72-136) ── */
{
  V.reset();
  check('determinism', 'V72-136 · Reset restores the seed exactly, Vedanta\'s person-entered height and the frozen DO Trigger included', J(V.S) === seedJson && V.S.params.vedanta.v_eq1.tankHeight.value === 4.5 && V.isFrozen('manesar', 'a_do_at2'));
  const here = { seed: { templates: sha(J(V.templates({}))), held: sha(J(V.S.held)), state: sha(J(V.S)) } };
  here.after = prints(V, edits(V));
  const other = child(['--boot']);
  check('determinism', 'V72-136 · two boots give byte-equal templates(), S.held and state at seed', !other.error && J(other.seed) === J(here.seed), other.error || `${J(other.seed)} vs ${J(here.seed)}`);
  check('determinism', 'V72-136 · and byte-equal templates(), deviations(), S.held and downstream() after the same edits', !other.error && J(other.after) === J(here.after), other.error || `${J(other.after)} vs ${J(here.after)}`);
  V.reset();
}

report();
function report() {
  const groups = [...new Set(results.map((r) => r.group))];
  console.log(`library72.test · ${results.length - fails}/${results.length} pass · ${Date.now() - t0} ms`);
  for (const g of groups) {
    const rs = results.filter((r) => r.group === g); const bad = rs.filter((r) => !r.ok);
    console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${g.padEnd(12)} ${rs.length - bad.length}/${rs.length}`);
    rs.filter((r) => !r.ok || VERBOSE).forEach((r) => console.log(`       ${r.ok ? '·' : '✗'} ${r.name}${r.detail != null ? `  [${String(r.detail).slice(0, 500)}]` : ''}`));
  }
  console.log(fails ? `RESULT: FAIL · ${fails} failing` : 'RESULT: PASS');
  process.exit(fails ? 1 : 0);
}
