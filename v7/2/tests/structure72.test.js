#!/usr/bin/env node
/* v7/2 · tests/structure72.test.js — headless test of core72-structure.js: unit-process types, identification, the structure
   pass, membership, control groups, subjects, attribution through diagnosis and the criticality tier derived from the structure.
   Node only, no dependencies. Runs in parts, each in its own process (one load per process):
     main      the whole v7/2 stack through tests/load72.js
     --alone   core7.js and this file only (LOAD72_UPTO=core72-structure.js): the same outcomes before the other core files exist,
               with this file's own chip words
     --boot    a second boot from empty storage, for the determinism checks
   Usage: TZ=Asia/Calcutta node tests/structure72.test.js [-v]     Exit code 0 = pass. */
'use strict';
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SELF = __filename;
const MODE = process.argv.find((a) => /^--(alone|boot)$/.test(a)) || 'main';
const VERBOSE = process.argv.includes('-v');
const KEYS = ['digitalpaani', 'vedanta', 'manesar', 'bawal'];
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const results = []; let fails = 0;
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail: detail == null ? undefined : String(detail) }); if (!ok) fails++; }
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb === undefined ? `threw: ${e.message}` : fb; } };
const emit = (o) => process.stdout.write('@@' + JSON.stringify(o) + '\n');
function child(args, env) {
  const r = spawnSync(process.execPath, [SELF, ...args], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { TZ: 'Asia/Calcutta' }, env || {}) });
  const line = String(r.stdout || '').split(/\r?\n/).filter((l) => l.startsWith('@@'))[0];
  if (!line) return { error: `${args.join(' ')} exited ${r.status}: ${String(r.stderr || r.stdout || '').slice(0, 600)}` };
  try { return JSON.parse(line.slice(2)); } catch (e) { return { error: 'bad output: ' + line.slice(0, 200) }; }
}
const fingerprint = (V) => ({ identify: sha(KEYS.map((k) => JSON.stringify(V.identify(k))).join('|')), structure: sha(JSON.stringify(V.S.structure)), overrides: sha(JSON.stringify(V.S.overrides.filter((o) => o.target && ['member', 'uptype', 'cg'].includes(o.target.kind)))), seq: V.S.seq, sseq: V.S.sseq });

/* ════════════════════════════════════ --boot: a second, fresh boot ══════════════════════════════════════════════════ */
if (MODE === '--boot') {
  const L = require('./load72.js');
  emit({ ...fingerprint(L.V7), errors: L.errors.map((e) => e.file) });
  process.exit(0);
}

const t0 = Date.now();
const L = require('./load72.js'); const V = L.V7; const __ = V && V.__;
const loadMs = Date.now() - t0;
check('load', 'the structure file loads and the story boots', !!V && L.errors.length === 0 && L.loaded.includes('core72-structure.js'), L.errors.map((e) => e.error.slice(0, 200)).join(' | ') || L.loaded.join(','));
if (!V || !L.loaded.includes('core72-structure.js')) { report(); }

/* helpers */
const nodeId = (k, tag) => { const n = V.nodes(k).find((e) => e.tag === tag); if (!n) throw new Error(`no ${tag} at ${k}`); return n.id; };
const ids = (k, ...tags) => tags.map((t) => nodeId(k, t));
const tagOf = (k, id) => (__.eqRaw(k, id) || {}).tag;
const structOvs = (k) => V.S.overrides.filter((o) => o.plant === k && o.target && ['member', 'uptype', 'cg'].includes(o.target.kind) && !o.endedAt && (o.status == null || o.status === 'active'));
const memberIn = (k, eqTag, upTag) => (V.membershipOf(k, nodeId(k, eqTag)).participatesIn || []).find((m) => m.tag === upTag) || null;
const ruleOf = (k, eqTag, upTag) => { const I = V.identify(k); const m = I.members.find((x) => x.eqId === nodeId(k, eqTag) && x.upId === nodeId(k, upTag)); return m ? m.rule : null; };
const RANK = { A: 3, B: 2, C: 1 };
/* words this file writes on screens: none of Alex's don't-use words and no v7/1 words */
const BANNED = [/\bmachines?\b/i, /\bassets?\b/i, /\bSCADA\b/i, /\bdatabase\b/i, /\bdetect\b/i, /\bpriority\b/i, /(?<!criticality )\btier\b/i, /(?<!limit |no )\brules?\b/i, /\bsurvey type\b/i, /\bunit operations?\b/i, /\bsub-assets?\b/i, /\balerts?\b/i, /\bschedules?\b/i, /\bCritical\b|\bEssential\b|\bStandard\b/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bbelongs to\b/i, /\bowned by\b/i, /\bcontains\b/i];
const badWords = (texts) => texts.filter((t) => typeof t === 'string' && BANNED.some((re) => re.test(t)));

const doneAlone = MODE === '--alone';

/* ══════════ 1. the library: unit-process types and equipment types ══════════ */
{
  const ups = V.upTypes(); const codes = (window.CATALOGUE || []).map((c) => c.code);
  const anchor = new Set(V.ANCHOR_CODES); const equip = codes.filter((c) => !anchor.has(c));
  check('library', 'V72-1 · 27 unit-process types; 29 anchor codes and 27 equipment codes split the 56 database codes', ups.length === 27 && codes.length === 56 && anchor.size === 29 && [...anchor].every((c) => codes.includes(c)) && equip.length === 27, `${ups.length} types · ${anchor.size} anchors · ${equip.length} equipment · ${codes.length} codes`);
  check('library', 'every unit-process type has a stage label, its content-from type and a version', ups.every((u) => u.stageLabel && u.contentFromName && u.version >= 1 && codes.includes(u.contentFrom)), ups.filter((u) => !u.contentFromName).map((u) => u.id).join(','));
  const sets = window.CTL.S.lib.standardSets;
  /* the same Triggers and Tasks by name, reading and direction as the database type's own data (values may move by a publish) */
  const shape = (set) => JSON.stringify({ a: set.alerts.map((a) => [a.name, a.sensorKind, a.direction]), s: set.schedules.map((x) => [x.name, x.workType]) });
  const seedSets = (window.SEED && window.SEED.standardSets) || [];
  const copyOk = V.UP_TYPES.every((t) => { const s = sets.find((x) => x.type === t.name); const src = seedSets.find((x) => x.type === (s || {}).contentFromName); return s && s.upType === t.id && src && shape(s) === shape(src); });
  check('library', 'each unit-process type carries an exact copy of its content-from type\'s readings, Triggers and Tasks', copyOk);
  const generic = V.UP_TYPES.filter((t) => t.generic).map((t) => t.name).sort().join(', ');
  check('library', 'the five generic types start with Open Skeleton Tank\'s content', generic === 'Chlorine contact, Collection sump, Equalisation, Sludge holding, Treated water storage' && V.UP_TYPES.filter((t) => t.generic).every((t) => V.upType(t.id).contentFromName === 'Open Skeleton Tank'), generic);
  const mb = V.upType('mbbr');
  check('library', 'Moving bed bioreactor brings what MBBR brings in v7/1 (Task templates, Issue types)', mb.schedules === (__.setOf('MBBR') || { schedules: [] }).schedules.length && mb.issues === V.issueTypes('MBBR').length && mb.schedules > 0 && mb.issues > 0, `${mb.schedules} Task templates · ${mb.issues} Issue types`);
  check('library', 'each anchor equipment type points to its unit-process types (Open Skeleton Tank to the five generic ones)', V.upTypesForCode('OS_TANK').length === 5 && V.upTypesForCode('MBBR')[0] === 'mbbr' && V.upTypesForCode('BLW').length === 0 && V.ANCHOR_CODES.every((c) => V.upTypesForCode(c).length));
  check('library', 'the plants\' counts per unit-process type (DigitalPaani has 5 Moving bed bioreactors)', (mb.plants.find((p) => p.key === 'digitalpaani') || {}).count === 5, JSON.stringify(mb.plants));
}

/* ══════════ 2. identification of the real plant graph ══════════ */
const dp = 'digitalpaani';
{
  const I = V.identify(dp); const s = V.structure(dp);
  check('identify', 'V72-9 · DigitalPaani: 21 unit processes, 45 pieces of equipment, 47 memberships, 11 control groups, 20 unclassified; 38 sensors', I.counts.ups === 21 && I.counts.equipment === 45 && I.counts.memberships === 47 && I.counts.cgs === 11 && I.counts.unclassified === 20 && s.counts.sensors === 38 && I.counts.nodes === 66, JSON.stringify(I.counts));
  const want = { SC: 'Collection sump', SP: 'Collection sump', OGT: 'Oil and grease removal', 'EQTT-1': 'Equalisation', 'EQTT-2': 'Equalisation', 'MBBR-1': 'Moving bed bioreactor', 'MBBR-2': 'Moving bed bioreactor', 'MBBR-3': 'Moving bed bioreactor', 'MBBR-4': 'Moving bed bioreactor', 'MBBR-5': 'Moving bed bioreactor', 'TS-1': 'Tube settling', 'TS-2': 'Tube settling', CCT: 'Chlorine contact', MGF: 'Media filtration', ACF: 'Media filtration', UVS: 'UV disinfection', 'UF-1': 'Ultrafiltration', 'UF-2': 'Ultrafiltration', TWT: 'Treated water storage', UFWT: 'Treated water storage', SLP: 'Sludge holding' };
  const got = Object.fromEntries(V.unitProcesses(dp).map((u) => [u.tag, u.proposedTypeName]));
  const wrong = Object.keys(want).filter((t) => got[t] !== want[t]);
  check('identify', 'V72-10 · DigitalPaani\'s proposed types', !wrong.length && Object.keys(got).length === 21, wrong.map((t) => `${t}: ${got[t]}`).join(', '));
  const m11 = ruleOf(dp, 'SRCP-1', 'MBBR-1') === 'b' && ruleOf(dp, 'SRCP-2', 'MBBR-1') === 'b' && ['MBBR-2', 'MBBR-3'].every((u) => ruleOf(dp, 'SRCP-1', u) === 'c' && ruleOf(dp, 'SRCP-2', u) === 'c')
    && ['MBBR-4', 'MBBR-5'].every((u) => ruleOf(dp, 'SRCP-3', u) && ruleOf(dp, 'SRCP-4', u)) && ['MBBR-1', 'MBBR-2', 'MBBR-3', 'MBBR-4', 'MBBR-5'].every((u) => ruleOf(dp, 'MBBRAB-1', u) === 'a')
    && ruleOf(dp, 'UFPV-1', 'UF-1') && ruleOf(dp, 'UFPV-1', 'UFWT') && ruleOf(dp, 'CDT', 'CCT') && ruleOf(dp, 'CDP', 'CCT')
    && ['SRCP-1', 'SRCP-2', 'SRCP-3', 'SRCP-4'].every((p) => !ruleOf(dp, p, 'TS-1') && !ruleOf(dp, p, 'TS-2'));
  check('identify', 'V72-11 · rules a to e: recirculation pumps in their MBBR loops, blowers in all five MBBRs, UF permeate valve in UF-1 and UFWT, hypo set in CCT, no sludge pump in a tube settler', m11);
  const order = V.unitProcesses(dp).map((u) => u.tag).join(' ');
  check('identify', 'flow order, inlet to outlet', order === 'SC SP OGT EQTT-1 EQTT-2 MBBR-1 MBBR-4 MBBR-2 MBBR-5 MBBR-3 TS-2 TS-1 CCT SLP MGF ACF UVS TWT UF-1 UF-2 UFWT', order);
  const why = (t) => (V.unitProcesses(dp).find((u) => u.tag === t) || {}).why;
  check('identify', 'each proposal says why in plain words', why('SC') === 'Nothing upstream but the plant inlet' && why('EQTT-1') === 'Fed by OGT, ahead of the biological treatment' && why('CCT') === 'Takes settled water from TS-1, TS-2 and a chemical dose from CDP' && why('SLP') === 'Fed by pumps that draw sludge from TS-2' && why('TWT') === 'Fed by UVS after treatment' && why('MBBR-1') === 'Its type, MBBR, makes it a moving bed bioreactor' && why('UVS') === 'Its type, UV, makes it a UV disinfection unit', ['SC', 'EQTT-1', 'CCT', 'SLP', 'TWT', 'MBBR-1', 'UVS'].map(why).join(' | '));
  const cgs = V.identify(dp).cgs; const cgName = (id) => (cgs.find((c) => c.id === id) || {}).name;
  check('identify', 'control groups by pump function and downstream set, named from the label stem', cgName('cg_mbbrab-1') === 'MBBR Air Blowers' && cgName('cg_ufbp-1') === 'UF Backwash Pumps' && cgName('cg_uffp-1') === 'UF Feed Pumps → UF-1' && cgName('cg_srcp-3') === 'Sludge Re-Circulation Pumps → MBBR-4, SLP' && (cgs.find((c) => c.id === 'cg_rfp-1') || {}).why === 'Both are Reactor Feed Pumps and feed the same downstream set (MBBR-1, MBBR-4)', cgs.map((c) => c.name).join(' | '));
  const u = s.unclassified.map((id) => tagOf(dp, id));
  check('identify', 'the unclassified list starts RFP-1, RFP-2, FFP-1 (the blocker names these)', u.slice(0, 3).join(',') === 'RFP-1,RFP-2,FFP-1' && u.length === 20, u.join(','));
  const rfp = V.structurePass(dp).groups[0].rows.find((r) => r.eqIds[0] === nodeId(dp, 'RFP-1'));
  check('identify', 'an unclassified row names its pipe neighbours', rfp && rfp.why === 'Fed by EQTT-1, EQTT-2; feeds MBBR-1, MBBR-4. No rule matches.', rfp && rfp.why);
  const p = V.structurePass(dp);
  check('identify', 'V72-12 · DigitalPaani\'s structure pass: all 76, proposed 56, unclassified 20, shared rows 15, control groups 11; not done', p.counts.all === 76 && p.counts.proposed === 56 && p.counts.unclassified === 20 && p.counts.shared === 15 && p.counts.cgs === 11 && V.structureDone(dp) === false && p.groups[0].key === 'unclassified' && p.groups[1].title === 'SC · Collection sump', JSON.stringify(p.counts));
  check('identify', 'the pass filters: unclassified, shared, control groups', V.structurePass(dp, { show: 'unclassified' }).groups.reduce((n, g) => n + g.rows.length, 0) === 20 && V.structurePass(dp, { show: 'shared' }).groups.reduce((n, g) => n + g.rows.length, 0) === 15 && V.structurePass(dp, { show: 'cgs' }).groups.reduce((n, g) => n + g.rows.length, 0) === 11);
  const tr = V.structureTrack(dp).map((x) => `${x.label}: ${x.detail}`);
  check('identify', 'the Structure track at seed', tr[1] === 'Plant graph built: 66 pieces of equipment · 38 sensors' && tr[2] === 'Identification run: 21 of them are unit processes · 11 control groups' && tr[3] === 'Structure pass: 76 to review · 20 unclassified' && V.structureTrack(dp)[3].state === 'current' && V.structureTrack(dp)[3].link === '#/p/digitalpaani/review/structure', tr.join(' | '));
}

/* ══════════ 3. the sample plants at seed ══════════ */
{
  const want = { vedanta: [4, 4, ['FP-1']], manesar: [7, 2, ['BS-1']], bawal: [3, 5, ['BS-1', 'SABRE-1']] };
  Object.entries(want).forEach(([k, [n, ov, np]]) => {
    const s = V.structure(k);
    check('seed', `V72-13 · ${k}: structure pass done, ${n} unit processes, ${ov} structure changes, not part: ${np.join(', ')}`, V.structureDone(k) === true && s.ups.length === n && structOvs(k).length === ov && s.notPart.map((id) => tagOf(k, id)).sort().join(',') === np.slice().sort().join(',') && s.unclassified.length === 0 && s.confirmedAt != null, `${s.ups.length} · ${structOvs(k).length} · ${s.notPart.map((id) => tagOf(k, id)).join(',')}`);
  });
  check('seed', 'DigitalPaani has no structure change and nothing decided', structOvs(dp).length === 0 && Object.keys(V.S.structure.digitalpaani.decisions).length === 0 && V.S.structure.digitalpaani.confirmedAt === null);
  const vt = V.structureTrack('vedanta')[3];
  check('seed', 'Vedanta\'s Structure track: confirmed, 4 placed by hand, 1 not part', vt.state === 'done' && vt.detail === 'Confirmed Fri 23 Oct, 10:25 · 4 placed by hand · 1 not part of any unit process', vt.detail);
  const vo = structOvs('vedanta'); const pair = (o) => `${tagOf('vedanta', o.target.eqId)}>${tagOf('vedanta', o.target.upId)}`;
  check('seed', 'Vedanta\'s four changes: P-1, P-2, MX-1 added to EQ-1 and SP-1 to TS-1, by Satyadev Singh, with notes, a one-year review and what identification said', vo.map(pair).join(',') === 'P-1>EQ-1,P-2>EQ-1,MX-1>EQ-1,SP-1>TS-1' && vo.every((o) => o.author === 'Satyadev Singh' && o.note && o.reason === 'structure' && o.reviewBy - o.at === 365 * 864e5 && o.algorithmSaid === 'Unclassified: no rule matches' && /^so_\d+$/.test(o.id) && o.target.op === 'add'), vo.map((o) => `${o.id}:${pair(o)}:${o.author}:${o.algorithmSaid}`).join(' '));
  const mo = structOvs('manesar').map((o) => `${tagOf('manesar', o.target.eqId)}>${tagOf('manesar', o.target.upId)}`).join(',');
  const bo = structOvs('bawal').map((o) => `${tagOf('bawal', o.target.eqId)}>${tagOf('bawal', o.target.upId)}`).join(',');
  check('seed', 'Manesar: SP-1 in SC-1 and CDU-1 in UF-1; Bawal: RW-1, RW-2 in MGF-1 and DP-1, DT-1, CV-1 in UF-1', mo === 'SP-1>SC-1,CDU-1>UF-1' && bo === 'RW-1>MGF-1,RW-2>MGF-1,DP-1>UF-1,DT-1>UF-1,CV-1>UF-1', `${mo} | ${bo}`);
  check('seed', 'Manesar\'s blowers take part in AT-1 and AT-2 and run as one control group', (V.membershipOf('manesar', 'bl1').participatesIn || []).map((m) => m.tag).join(',') === 'AT-1,AT-2' && (V.membershipOf('manesar', 'bl1').controlGroups[0] || {}).name === 'Air Blowers');
  check('seed', 'nothing here drew from the shared id counter (structure changes have their own)', V.S.seq === 202 && V.S.sseq === 11, `seq ${V.S.seq} · sseq ${V.S.sseq}`);
  const act = (k) => V.activity({ plant: k }).filter((a) => a.kind === 'structure').map((a) => `${a.who} | ${a.text}`);
  check('seed', 'Activity: DigitalPaani\'s plant graph read, worked out from identification', act(dp).join('\n') === 'Automatic | Plant graph read: 66 pieces of equipment and 38 sensors from the real survey layout. Identification proposed 21 unit processes and 11 control groups; 20 pieces of equipment are unclassified. Nothing reviewed yet', act(dp).join(' / '));
  check('seed', 'Activity: Vedanta\'s commissioning start and its structure pass', act('vedanta').includes('Automatic | Commissioning started: plant graph read, 13 pieces of equipment. Identification proposed 4 unit processes and 2 control groups; 5 pieces of equipment are unclassified') && act('vedanta').includes('Satyadev Singh | Structure confirmed: 4 unit processes, 2 control groups. P-1, P-2 and MX-1 added to EQ-1; SP-1 added to TS-1; FP-1 marked not part of any unit process'), act('vedanta').join(' / '));
  check('seed', 'Activity: Manesar\'s and Bawal\'s structure passes, before they went live', act('manesar').includes('Swadesh Singh | Structure confirmed: 7 unit processes, 1 control group. SP-1 added to SC-1; CDU-1 added to UF-1; BS-1 marked not part of any unit process') && act('bawal').some((x) => /^Rohit Jain \| Structure confirmed: 3 unit processes, 1 control group\. RW-1.+added to MGF-1; DP-1, DT-1 and CV-1 added to UF-1; BS-1 and SABRE-1 marked not part of any unit process$/.test(x)) && V.activity({ plant: 'manesar' }).find((a) => /^Structure confirmed/.test(a.text)).at < V.activity({ plant: 'manesar' }).find((a) => a.text === 'Went live').at, `${act('manesar').join(' / ')} || ${act('bawal').join(' / ')}`);
  check('seed', 'no v7/1 "SCADA read" or "Accepted what SCADA found" line is left', !V.activity({}).some((a) => /SCADA read|Accepted what SCADA found|Commissioning started: SCADA/.test(a.text)));
  const anchorsTyped = KEYS.every((k) => V.identify(k).ups.every((u) => __.eqRaw(k, u.id).libType === V.UP_TYPES.find((t) => t.id === u.typeId).name));
  check('seed', 'every basin or reactor node reads its unit-process type\'s content', anchorsTyped);
}

/* ══════════ 4. criticality tier derived from the structure ══════════ */
{
  const tv = (k, tag) => V.tierInfo(k, nodeId(k, tag));
  const b = ['V-1', 'DT-1', 'CV-1'].map((t) => tv('bawal', t));
  check('tier', 'V72-24 · Bawal at seed: V-1 B, DT-1 A, CV-1 A, derived from the unit processes they take part in', b[0].value === 'B' && b[1].value === 'A' && b[2].value === 'A' && b.every((x) => x.src === 'derived' && x.chip && x.chip.tone === 'der'), b.map((x) => `${x.value}/${x.src}/${x.chipText}`).join(' · '));
  check('tier', 'the derived chip names the unit process that raised it', b[0].chipText === 'Derived · highest of MGF-1' && b[1].chipText === 'Derived · highest of UF-1' && b[0].derivedFrom.join() === 'sc_mgf1', b.map((x) => x.chipText).join(' · '));
  const dpT = ['UFFV-1', 'UFFV-2', 'UFPV-1', 'UFPV-2', 'UFBOV-1', 'UFBOV-2', 'UFBP-1', 'UFBP-2', 'UFBP-3', 'UFBP-4'].map((t) => tv(dp, t));
  check('tier', 'DigitalPaani at seed: the UF valves and backwash pumps are A from their proposed memberships', dpT.every((x) => x.value === 'A' && x.src === 'derived'), dpT.map((x) => x.value + x.src[0]).join(' '));
  let never = true; let mirror = true; const bad = [];
  KEYS.forEach((k) => V.nodes(k).forEach((n) => { const t = V.tierInfo(k, n.id); if (RANK[t.base] < RANK[t.libValue]) { never = false; bad.push(`${k}:${n.tag}`); } if (t.src === 'derived' && !(RANK[t.base] > RANK[t.libValue])) never = false; if (__.eqRaw(k, n.id).tier !== t.value) { mirror = false; bad.push(`mirror ${k}:${n.tag}`); } }));
  check('tier', 'a derived tier is never lower than the type\'s tier, and the stored tier follows the effective one', never && mirror, bad.slice(0, 6).join(', '));
  const sp1 = tv('manesar', 'SP-1');
  check('tier', 'Manesar SP-1 keeps its override C over a base of B (derived from SC-1 gives the same B)', sp1.value === 'C' && sp1.src === 'override' && sp1.base === 'B' && sp1.overrideId && sp1.overrideState !== 'basemoved', `${sp1.value}/${sp1.src}/${sp1.base}/${sp1.overrideState}`);
  const ufb = tv('manesar', 'UF-1');
  check('tier', 'a unit process\'s tier is its node\'s (no derivation)', ufb.src === 'library' && ufb.value === 'A' && tv('vedanta', 'EQ-1').src === 'library');
}

/* ══════════ 5. subjects ══════════ */
{
  const a = (k, id) => V.alerts(k).find((x) => x.id === id);
  const subj = (x) => (x && x.subject ? `${x.subject.kind}:${x.subject.id}` : 'none');
  const bl1 = V.alerts('vedanta').find((x) => x.subject && x.subject.id === 'v_bl1' && /Motor current/.test(x.name));
  const is2z = V.issue('manesar', 'is_2z');
  check('subjects', 'V72-72 · DO low · SBR-1 is about the unit process SBR-1, pH low · EQ-1 about EQ-1, Motor current high · BL-1 about the blower; Manesar\'s open DO low · AT-2 Issue about AT-2', subj(a('vedanta', 'a_3r')) === 'up:v_sbr' && subj(a('vedanta', 'a_3f')) === 'up:v_eq1' && subj(bl1) === 'eq:v_bl1' && subj(is2z) === 'up:at2' && is2z.subject.text === 'AT-2 · Activated sludge', [subj(a('vedanta', 'a_3r')), subj(a('vedanta', 'a_3f')), subj(bl1), subj(is2z)].join(' '));
  check('subjects', 'a Trigger on a unit process has no equipment id and names its unit process', a('vedanta', 'a_3r').eqId === null && a('vedanta', 'a_3r').upId === 'v_sbr' && bl1.eqId === 'v_bl1' && bl1.upId === null);
  check('subjects', 'the stored Issue record keeps {kind, id} (the engine took it from the subject hook)', JSON.stringify(V.__.issueRaw('manesar', 'is_2z').subject) === '{"kind":"up","id":"at2"}');
  check('subjects', 'Vedanta\'s other subjects: Level high and pH high on EQ-1, pH low on AN-1, MLSS on SBR-1, sludge blanket on TS-1', ['a_3d'].every((id) => subj(a('vedanta', id)) === 'up:v_eq1') && V.alerts('vedanta').filter((x) => /AN-1/.test(x.name)).every((x) => subj(x) === 'up:v_an1') && V.alerts('vedanta').filter((x) => /MLSS/.test(x.name)).every((x) => subj(x) === 'up:v_sbr') && V.alerts('vedanta').filter((x) => /blanket/i.test(x.name)).every((x) => subj(x) === 'up:v_ts1'));
  /* no Trigger, Issue or Task is ever about a control group */
  let kinds = new Set(); KEYS.forEach((k) => { V.alerts(k).forEach((x) => kinds.add(x.subject ? x.subject.kind : 'none')); V.issues(k).forEach((x) => kinds.add(x.subject ? x.subject.kind : 'none')); V.tasks(k).forEach((x) => kinds.add(x.subject ? x.subject.kind : 'none')); });
  const cgv = V.controlGroup('vedanta', 'cg_bl-1');
  check('subjects', 'V72-71 · no Task, Issue or Trigger has a control group as its subject; a control-group view has member work and no tasks', [...kinds].every((x) => ['up', 'eq', 'plant'].includes(x)) && KEYS.every((k) => V.controlGroups(k).every((c) => !('tasks' in c) && Array.isArray(c.memberWork))), [...kinds].join(','));
  check('subjects', 'Vedanta\'s blowers group shows the work each member carries', cgv.memberWork.length > 0 && cgv.memberWork.some((w) => /^Routine check - Blower running parameters log · on each of 2 members · \d+(\.\d+)? a day$/.test(w.text)) && cgv.memberWork.every((w) => !/· 0 a (day|week|month)$/.test(w.text)) && cgv.memberIds.join() === 'v_bl1,v_bl2', cgv.memberWork.map((w) => w.text).join(' | '));
  const plantTasks = V.tasks('manesar').filter((t) => t.plantLevel);
  check('subjects', 'plant rounds are about the plant', plantTasks.length > 0 && plantTasks.every((t) => t.subject && t.subject.kind === 'plant' && t.subject.text === 'The plant'));
  check('subjects', 'subjectOf: unit process, equipment, the plant', V.subjectOf('manesar', 'at2').kind === 'up' && V.subjectOf('manesar', 'at2').href === '#/p/manesar/up/at2' && V.subjectOf('manesar', 'bl1').kind === 'eq' && V.subjectOf('manesar', { kind: 'plant' }).kind === 'plant' && V.subjectOf('manesar', { kind: 'cg', id: 'cg_bl-1' }) === null);
  const sh = V.issues('manesar', { upId: 'at2', includeShared: true }); const bl1Issues = V.issues('manesar').filter((i) => i.subject && i.subject.id === 'bl1');
  check('subjects', 'V72-74 · AT-2\'s Issues include BL-1\'s, marked shared', bl1Issues.length > 0 && bl1Issues.every((i) => sh.some((x) => x.id === i.id && x.shared === true && x.sharedVia === 'bl1' && x.sharedText === 'Shared · on BL-1')) && sh.some((x) => x.id === 'is_2z' && !x.shared), `${sh.length} on AT-2 · ${sh.filter((x) => x.shared).length} shared · BL-1 has ${bl1Issues.length}`);
  check('subjects', 'without includeShared only AT-2\'s own Issues; filtering by subject kind', V.issues('manesar', { upId: 'at2' }).every((x) => !x.shared && x.subject.id === 'at2') && V.issues('manesar', { subject: 'eq' }).every((x) => x.subject.kind === 'eq') && V.issues('manesar', { subject: 'up' }).length > 0);
  check('subjects', 'equipment lists equipment only; every node is still reachable by id', V.equipment(dp).length === 45 && V.equipment(dp).every((e) => e.kind === 'eq') && V.nodes(dp).length === 66 && V.eq(dp, nodeId(dp, 'MBBR-1')).kind === 'up' && V.upOfBasin(dp, nodeId(dp, 'MBBR-1')).tag === 'MBBR-1' && V.upOfBasin(dp, nodeId(dp, 'RFP-1')) === null);
  const pv = V.plant(dp);
  check('subjects', 'the plant view counts unit processes and equipment apart', pv.upCount === 21 && pv.equipmentCount === 45 && pv.nodeCount === 66 && pv.cgCount === 11 && pv.unclassified === 20, JSON.stringify({ u: pv.upCount, e: pv.equipmentCount, n: pv.nodeCount }));
  const it = V.issueTypesFor('vedanta', { kind: 'up', id: 'v_ts1' });
  check('subjects', 'a unit process offers its type\'s Issue types; the plant offers none', it.length === V.issueTypes('Tube settler').length && it.length > 0 && V.issueTypesFor('manesar', { kind: 'up', id: 'at2' }).length === V.issueTypes('Diffuser Tank').length && V.issueTypesFor('manesar', { kind: 'plant' }).length === 0, `${it.length} on TS-1`);
  const rp = V.report('manesar', { kind: 'plant' }, it[0].id);
  check('subjects', 'V72-77 (core) · reporting on the whole plant is refused with Alex\'s sentence', !rp.ok && rp.error === 'No problems are written for the whole plant yet. Report it on the unit process or equipment where you saw it.', rp.error);
}

/* ══════════ 6. attribution through diagnosis ══════════ */
{
  const iss0 = V.issue('manesar', 'is_2z');
  const step = V.diagStep('manesar', 'is_2z'); let r = step ? V.answer('manesar', 'is_2z', step.id, 'No') : null;
  if (!r || !r.causeId) { const c = (V.causesFor('manesar', 'is_2z') || []).find((x) => /intake filter/i.test(x.name)); r = c ? V.chooseCause('manesar', 'is_2z', c.id) : { causedBy: null }; }
  const log = (V.issue('manesar', 'is_2z').log || []).map((l) => l.text);
  check('attribution', 'V72-73 · DO low · AT-2 diagnosed to the intake filter lands on BL-1, because BL-1 takes part in AT-2', iss0 && r && r.causedBy === 'bl1' && log.includes('Caused by BL-1 (Blower; takes part in AT-2)'), `${r && r.causedBy} · ${log.slice(-2).join(' / ')}`);
  /* the hook's three steps on synthetic Issues: a basin's own type set aside; equipment sharing a unit process; the plant */
  const hook = __.HOOKS.causeCandidates;
  const ownOnly = hook('manesar', { subject: { kind: 'up', id: 'at2' } }, { types: ['Diffuser Tank'] });
  const viaShare = hook('vedanta', { subject: { kind: 'eq', id: 'v_p2' } }, { types: ['Agitator'] });
  const ownType = hook('manesar', { subject: { kind: 'eq', id: 'bl2' } }, { types: ['Blower'] });
  const vedAny = hook('vedanta', { subject: { kind: 'eq', id: 'v_p2' } }, { types: ['Blower'] });
  const anyAt = hook('manesar', { subject: { kind: 'up', id: 'eq1' } }, { types: ['Blower'] });
  check('attribution', 'a cause typed only to the basin\'s own type is the unit process\'s own: nothing attributed', ownOnly === null);
  check('attribution', 'equipment: a running piece of the cause\'s type that shares a unit process comes first', Array.isArray(viaShare) && viaShare[0].eqId === 'v_mx1' && viaShare[0].text === 'Caused by MX-1 (Agitator; shares EQ-1)', JSON.stringify(viaShare));
  check('attribution', 'a cause typed to the equipment\'s own type stays on it (nothing attributed elsewhere)', ownType === null);
  check('attribution', 'equipment with no partner of that type in its unit processes: any running one at the plant', Array.isArray(vedAny) && vedAny[0].eqId === 'v_bl1' && vedAny[0].text === 'Caused by BL-1 (Blower at this plant)', JSON.stringify(vedAny));
  check('attribution', 'no participant of that type: any running one at the plant', Array.isArray(anyAt) && anyAt[0].eqId === 'bl1' && anyAt[0].text === 'Caused by BL-1 (Blower at this plant)', JSON.stringify(anyAt));
}

/* ══════════ 7. Live plants: structure edits need a reason and flag the Triggers they touch ══════════ */
{
  const before = structOvs('manesar').length;
  const r0 = V.place('manesar', 'bs1', ['eq1'], {});
  check('live', 'V72-75 · placing BS-1 in EQ-1 on a Live plant without a reason is refused', !r0.ok && r0.error === 'Give a reason: this plant is Live.' && structOvs('manesar').length === before, r0.error);
  const pv = V.membershipPreview('manesar', [{ op: 'add', upId: 'eq1', eqId: 'bs1' }]);
  check('live', 'the preview names the Trigger it re-checks', pv.lines[0] === '1 Trigger re-checked: Sump flooding · EQ-1' && pv.triggers.length === 1 && pv.triggers[0].alertId === 'a_flood', pv.lines.join(' · '));
  const r1 = V.place('manesar', 'bs1', ['eq1'], { note: 'The screen sits in EQ-1\'s inlet channel' }); const fl = V.structureFlag('manesar', 'a_flood');
  check('live', 'with a reason it saves, and Sump flooding · EQ-1 shows "Structure changed …"', r1.ok && r1.toast === 'BS-1 placed in EQ-1' && fl && /^Structure changed Thu 29 Oct, 09:00: BS-1 placed in EQ-1\. Nothing in this Trigger's terms changed\.$/.test(fl.line) && V.alerts('manesar').find((a) => a.id === 'a_flood').structureFlag.line === fl.line, `${r1.error || r1.toast} · ${fl && fl.line}`);
  const last = V.activity({ plant: 'manesar', limit: 1 })[0];
  check('live', 'Activity keeps the reason and names the flagged Trigger, with an undo token', last.text === 'BS-1 placed in EQ-1 · Reason: The screen sits in EQ-1\'s inlet channel · 1 Trigger flagged: Sump flooding · EQ-1' && last.kind === 'structure' && last.undoToken === r1.token, last.text);
  check('live', 'BS-1 now takes part in EQ-1 (Added) and is no longer outside', (memberIn('manesar', 'BS-1', 'EQ-1') || {}).state === 'added' && !V.structure('manesar').notPart.includes('bs1'));
  const ck = V.clearStructureFlag('manesar', 'a_flood');
  check('live', 'Mark as checked clears the flag', ck.ok && V.structureFlag('manesar', 'a_flood') === null);
  const ct = V.changeUpType('manesar', 'eq1', 'sump', { note: 'x' });
  check('live', 'a unit process\'s type can\'t change once the structure is confirmed', !ct.ok && ct.error === 'The structure is confirmed. Changing a unit process\'s type re-proposes its bindings, which this study doesn\'t do.', ct.error);
  check('live', 'every other structure action on a Live plant needs a reason too', !V.editMembers('manesar', [{ op: 'remove', upId: 'at1', eqId: 'bl2' }], {}).ok && !V.notPart('bawal', 'sc_p1', {}).ok && !V.makeControlGroup('bawal', ['sc_p1', 'sc_p2'], {}).ok && !V.rejectStructure('manesar', 'cg:cg_bl-1', {}).ok);
}

/* ══════════ 8. the structure pass, walked (from a fresh story) ══════════ */
V.reset();
{
  const SC = nodeId(dp, 'SC');
  const pv = V.membershipPreview(dp, [{ op: 'type', upId: SC, typeId: 'screening' }]);
  check('pass', 'V72-15 · changing SC to Screening: 14 Task templates and 6 Issue types (from 1 Task template), about 28.8 more Tasks a day', pv.content.to.tasks === 14 && pv.content.to.issues === 6 && pv.content.from.tasks === 1 && Math.abs(pv.content.perDayDelta - 28.8) <= 0.1, `${pv.content.to.tasks} · ${pv.content.to.issues} · ${pv.content.from.tasks} · ${pv.content.perDayDelta.toFixed(2)}`);
  check('pass', 'the consequence reads as drawn', pv.lines.join(' ') === "Screening brings 14 Task templates and 6 Issue types; 1 Trigger template needs a sensor SC doesn't have (H2S). Collection sump brings 1 Task template; 4 Trigger templates need sensors SC doesn't have. About 28.8 more Tasks a day once Live.", pv.lines.join(' '));
  const opts = V.upTypeOptions(dp, SC);
  check('pass', 'a generic tank offers all 27 types, the proposed one first; a specific one only its own', opts.length === 27 && opts[0].id === 'sump' && opts[0].proposed && V.upTypeOptions(dp, nodeId(dp, 'MBBR-1')).length === 1);
  check('pass', 'SC\'s Details fact: drawn as Screen Chamber Tank, stored as Open Skeleton Tank', V.unitProcess(dp, SC).drawnFact === 'Drawn in the plant graph as Screen Chamber Tank; stored in the survey as Open Skeleton Tank.', V.unitProcess(dp, SC).drawnFact);
  const r = V.changeUpType(dp, SC, 'screening', {}); const ut = structOvs(dp).filter((o) => o.target.kind === 'uptype');
  check('pass', 'V72-15 · the change writes one type change, SC reads Screening\'s content and the pass shows 55 proposed', r.ok && r.toast === 'SC is now Screening' && ut.length === 1 && ut[0].value === 'screening' && ut[0].base === 'sump' && ut[0].target.upId === SC && __.eqRaw(dp, SC).libType === 'Screening' && V.structurePass(dp).counts.proposed === 55 && V.unitProcess(dp, SC).typeState === 'changed', `${r.error || r.toast} · ${ut.length} · ${V.structurePass(dp).counts.proposed}`);
  const a = V.acceptStructure(dp, { all: true }); const p1 = V.structurePass(dp);
  check('pass', 'V72-16 · Accept all 55: every proposed row accepted, 20 unclassified left', a.ok && a.count === 55 && a.toast === 'Accepted 55' && p1.counts.proposed === 0 && p1.counts.unclassified === 20 && p1.counts.toReview === 20, JSON.stringify(p1.counts));
  const ufbp = p1.groups.find((g) => g.key === 'cgs').rows.find((x) => x.cgId === 'cg_ufbp-1');
  check('pass', 'the bulk accept confirmed one control group over both UF trains', ufbp.state === 'accepted' && V.controlGroup(dp, 'cg_ufbp-1').state === 'confirmed' && V.controlGroup(dp, 'cg_ufbp-1').memberIds.length === 4);
  const u = V.undoStructure(dp, a.token);
  check('pass', 'V72-16 · Undo brings the 55 proposals back', u.ok && V.structurePass(dp).counts.proposed === 55, JSON.stringify(V.structurePass(dp).counts));
  const a2 = V.acceptStructure(dp, { all: true });
  const np = V.notPart(dp, ids(dp, 'ITP-1', 'ITP-2', 'FWTP-1', 'FWTP-2'), {});
  check('pass', 'four set aside as not part of any unit process: 16 left', a2.ok && np.ok && V.structure(dp).counts.unclassified === 16 && np.toast === 'ITP-1, ITP-2, FWTP-1 and FWTP-2 marked not part of any unit process', np.error || np.toast);
  const before = structOvs(dp).length; const ch = ids(dp, 'UFFP-1', 'UFFP-2', 'UFBV-1').map((e) => ({ op: 'add', upId: nodeId(dp, 'UF-1'), eqId: e }));
  const pp = V.membershipPreview(dp, ch); const pl = V.place(dp, ids(dp, 'UFFP-1', 'UFFP-2', 'UFBV-1'), [nodeId(dp, 'UF-1')], {});
  const t1 = V.tierInfo(dp, nodeId(dp, 'UFFP-1')); const adds = structOvs(dp).filter((o) => o.target.kind === 'member' && o.target.op === 'add' && o.target.eqId === nodeId(dp, 'UFFP-1'));
  check('pass', 'V72-17 · placing UFFP-1 in UF-1: the preview said "Criticality tier for UFFP-1: B → A"; a member add is written; 13 left; UFFP-1 is A, derived', pp.lines.includes('Criticality tier for UFFP-1: B → A') && pp.lines.includes('Criticality tier for UFBV-1: C → A') && pl.ok && structOvs(dp).length === before + 3 && adds.length === 1 && adds[0].target.upId === nodeId(dp, 'UF-1') && V.structure(dp).counts.unclassified === 13 && t1.value === 'A' && t1.src === 'derived' && t1.chip.tone === 'der', `${pp.lines.join(' · ')} · ${t1.value}/${t1.src}`);
  const plLine = V.activity({ plant: dp, limit: 1 })[0].text;
  check('pass', 'the Activity line says which criticality tiers the placement moved (nothing changes silently)', plLine === 'UFFP-1, UFFP-2 and UFBV-1 placed in UF-1 · Criticality tier for UFBV-1: C → A · Criticality tier for UFFP-1: B → A · Criticality tier for UFFP-2: B → A' && pl.tiers.length === 3, plLine);
  V.place(dp, ids(dp, 'UFFP-3', 'UFFP-4', 'UFBV-2'), [nodeId(dp, 'UF-2')], {});
  const rf = V.place(dp, ids(dp, 'RFP-1', 'RFP-2'), ids(dp, 'MBBR-1', 'MBBR-4'), {});
  V.place(dp, ids(dp, 'FFP-1', 'FFP-2'), [nodeId(dp, 'MGF')], {}); V.place(dp, ids(dp, 'SPFP-1', 'SPFP-2'), [nodeId(dp, 'SLP')], {});
  const fin = V.notPart(dp, ids(dp, 'PDT', 'PDP', 'SCP-1', 'SCP-2'), {});
  check('pass', 'the last decision confirms the structure and opens the bindings pass', rf.toast === 'RFP-1 and RFP-2 placed in MBBR-1 and MBBR-4' && fin.ok && fin.confirmed === true && fin.toast === 'Structure confirmed: 21 unit processes, 11 control groups. The bindings pass is open' && V.structureDone(dp) && V.structure(dp).state === 'confirmed', fin.error || fin.toast);
  const tr = V.structureTrack(dp)[3];
  check('pass', 'the Structure track: confirmed, 12 placed by hand, 1 type changed, 8 not part', tr.state === 'done' && tr.detail === 'Confirmed Thu 29 Oct, 09:00 · 12 placed by hand · 1 type changed · 8 not part of any unit process' && structOvs(dp).length === 15, `${tr.detail} · ${structOvs(dp).length}`);
  const conf = V.activity({ plant: dp, limit: 1 })[0];
  check('pass', 'Activity says what the pass did', conf.text === 'Structure confirmed: 21 unit processes, 11 control groups; 55 proposals accepted, 1 type changed, 12 pieces of equipment placed by hand, 8 marked not part of any unit process. The bindings pass is open', conf.text);
  const ts = nodeId(dp, 'TS-1'); const ch7 = ids(dp, 'SRCP-1', 'SRCP-2').map((e) => ({ op: 'add', upId: ts, eqId: e }));
  const p7 = V.membershipPreview(dp, ch7); const e7 = V.editMembers(dp, ch7, {});
  check('pass', 'membership on the drawing: SRCP-1, SRCP-2 added to TS-1, with nothing depending on it', p7.text === 'No Trigger depends on this · criticality tiers unchanged' && e7.ok && e7.toast === 'Saved · SRCP-1, SRCP-2 added to TS-1' && (memberIn(dp, 'SRCP-1', 'TS-1') || {}).state === 'added' && V.membershipOf(dp, nodeId(dp, 'SRCP-1')).participatesIn.map((m) => m.tag).join(',') === 'MBBR-1,MBBR-2,MBBR-3,TS-1', `${p7.text} · ${e7.toast}`);
  const mb1 = V.unitProcess(dp, nodeId(dp, 'MBBR-1')); const roles = mb1.participants.map((x) => `${x.tag}:${x.state}`).join(',');
  check('pass', 'MBBR-1\'s participants: three shared blowers, two recirculation pumps, RFP-1 and RFP-2 added', roles === 'MBBRAB-1:confirmed,MBBRAB-2:confirmed,MBBRAB-3:confirmed,SRCP-1:confirmed,SRCP-2:confirmed,RFP-1:added,RFP-2:added' && mb1.participants[0].alsoIn.length === 4 && mb1.participants[0].roleLabel === 'Blowers', roles);
  const rmv = V.editMembers(dp, [{ op: 'remove', upId: nodeId(dp, 'MBBR-5'), eqId: nodeId(dp, 'SRCP-3') }], {});
  check('pass', 'removing a proposed member writes a remove and lists it as removed', rmv.ok && rmv.toast === 'Saved · SRCP-3 removed from MBBR-5' && V.unitProcess(dp, nodeId(dp, 'MBBR-5')).removed.map((x) => x.tag).join() === 'SRCP-3' && !memberIn(dp, 'SRCP-3', 'MBBR-5'));
  const back = V.editMembers(dp, [{ op: 'add', upId: nodeId(dp, 'MBBR-5'), eqId: nodeId(dp, 'SRCP-3') }], {});
  check('pass', 'putting it back ends the remove (it is Confirmed again, not Added)', back.ok && (memberIn(dp, 'SRCP-3', 'MBBR-5') || {}).state === 'confirmed' && V.unitProcess(dp, nodeId(dp, 'MBBR-5')).removed.length === 0);
  const mk = V.makeControlGroup(dp, ids(dp, 'ITP-1', 'ITP-2'), { name: 'Irrigation pumps' }); const cg = V.controlGroup(dp, mk.cgId);
  check('pass', 'a control group made by hand', mk.ok && mk.toast === 'Control group made: Irrigation pumps' && cg && cg.state === 'made' && cg.memberIds.length === 2 && !('tasks' in cg), mk.error || mk.toast);
  const ed = V.editControlGroup(dp, 'cg_ufbp-1', { remove: ids(dp, 'UFBP-3', 'UFBP-4') }, {});
  check('pass', 'editing a proposed control group writes the new members', ed.ok && V.controlGroup(dp, 'cg_ufbp-1').state === 'changed' && V.controlGroup(dp, 'cg_ufbp-1').memberIds.length === 2 && ed.toast === 'Control group UF Backwash Pumps: removed UFBP-3, UFBP-4', ed.error || ed.toast);
  check('pass', 'a control group needs two members, and only blowers and pumps', !V.makeControlGroup(dp, ids(dp, 'ITP-1'), {}).ok && !V.makeControlGroup(dp, ids(dp, 'UFBV-1', 'UFBV-2'), {}).ok);
  const twice = V.makeControlGroup(dp, ids(dp, 'RFP-1', 'FFP-1'), {});
  check('pass', 'a piece of equipment runs under one setpoint only: a second control group for it is refused', !twice.ok && twice.error === 'RFP-1 already runs in Reactor Feed Pumps: take it out there first.', twice.error);
  const ch2 = V.changeUpType(dp, nodeId(dp, 'SP'), 'equalisation', {});
  check('pass', 'once confirmed, a type change is refused', !ch2.ok && /^The structure is confirmed/.test(ch2.error));
  check('pass', 'Deviations reads structure changes in words', V.structureChanges({ plant: dp }).some((x) => x.line === 'SC · type Collection sump → Screening') && V.structureChanges({ plant: dp }).some((x) => x.line === 'TS-1 · SRCP-1 added' && x.detail === 'Added · not proposed' && x.href === `#/p/digitalpaani/structure?select=up:${ts}`) && V.structureChanges({ plant: 'vedanta' }).length === 4, V.structureChanges({ plant: dp }).slice(0, 3).map((x) => x.line).join(' | '));
  const bg = V.bindingGroups(dp); const all = bg.flatMap((g) => g.eqIds);
  check('pass', 'binding groups: each node once, under its first unit process in flow order, the rest outside', all.length === 66 && new Set(all).size === 66 && bg[bg.length - 1].upId === null && bg[bg.length - 1].title === 'Outside any unit process' && bg[0].title === 'SC · Screening', `${all.length} · ${bg.length}`);
}

/* ══════════ 9. undo from the toast and from Activity ══════════ */
V.reset();
{
  const t1 = V.notPart(dp, nodeId(dp, 'ITP-1'), {}); const entry = V.activity({ plant: dp, limit: 1 })[0];
  check('undo', 'V72-23 · every structure action carries an undo token, in its result and on its Activity line', t1.ok && /^u_\d+$/.test(t1.token) && entry.undoToken === t1.token && V.canUndo(dp, t1.token), `${t1.token} · ${entry.undoToken}`);
  const t2 = V.place(dp, nodeId(dp, 'UFFP-1'), [nodeId(dp, 'UF-1')], {});
  check('undo', 'a later action on other rows leaves Undo available', t2.ok && V.canUndo(dp, t1.token) && V.canUndo(dp, t2.token));
  const t3 = V.place(dp, nodeId(dp, 'ITP-1'), [nodeId(dp, 'UF-1')], {});
  check('undo', 'a later action on the same rows takes Undo away', t3.ok && !V.canUndo(dp, t1.token) && !V.undoStructure(dp, t1.token).ok);
  const u3 = V.undoStructure(dp, t3.token);
  check('undo', 'undoing the later one gives it back; an undone action can\'t be undone again', u3.ok && !V.canUndo(dp, t3.token) && V.canUndo(dp, t1.token) && V.activity({ plant: dp, limit: 1 })[0].text === 'Undone: ITP-1 placed in UF-1');
  const u1 = V.undoStructure(dp, t1.token);
  check('undo', 'after undo the equipment is unclassified again and its record is gone', u1.ok && V.structure(dp).unclassified.includes(nodeId(dp, 'ITP-1')) && !V.S.structure.digitalpaani.decisions[`u:${nodeId(dp, 'ITP-1')}`] && V.structure(dp).counts.unclassified === 19);
  const u2 = V.undoStructure(dp, t2.token);
  check('undo', 'undoing a placement removes its record and its derived tier', u2.ok && V.structure(dp).counts.unclassified === 20 && V.tierInfo(dp, nodeId(dp, 'UFFP-1')).value === 'B' && structOvs(dp).length === 0);
  const m = V.place('manesar', 'bs1', ['eq1'], { note: 'The screen sits in EQ-1\'s inlet channel' }); const um = V.undoStructure('manesar', m.token);
  check('undo', 'undo on a Live plant also takes the Trigger flag back', m.ok && um.ok && V.structureFlag('manesar', 'a_flood') === null && V.structure('manesar').notPart.includes('bs1'));
}

/* ══════════ 10. re-running identification ══════════ */
V.reset();
{
  const out = KEYS.map((k) => { const nd = Object.keys(V.S.structure[k].decisions).length, ne = structOvs(k).length; const r = V.rerunIdentification(k); return { k, r, keep: Object.keys(V.S.structure[k].decisions).length === nd && structOvs(k).length === ne, nd, ne }; });
  check('rerun', 'V72-18 · re-running identification on every plant: 0 changed, 0 added, 0 gone; every decision and change kept', out.every((x) => x.r.ok && !x.r.changed.length && !x.r.added.length && !x.r.gone.length && x.keep), out.map((x) => `${x.k}:${x.r.changed.length}/${x.r.added.length}/${x.r.gone.length}/${x.keep}`).join(' '));
  check('rerun', 'it says so in plain words', out[1].r.text === `Identification re-run: nothing changed in the plant graph. Your ${out[1].nd} decisions and ${out[1].ne} edits are kept.` && out[0].r.text === 'Identification re-run: nothing changed in the plant graph. Your 0 decisions and 0 edits are kept.', out[1].r.text);
}

/* ══════════ 11. the drawing ══════════ */
{
  const d = V.drawing(dp);
  check('drawing', 'V72-19 · DigitalPaani\'s drawing: 66 nodes (21 unit processes), its frame and 96 pipes; the sample plants have none', d && d.nodes.length === 66 && d.nodes.filter((n) => n.kind === 'up').length === 21 && JSON.stringify(d.viewBox) === '[-330,-814,7922,2125]' && d.links.length === 96 && d.zoom === 0.25 && d.points.length === 10 && V.drawing('vedanta') === null && V.drawing('manesar') === null, d && `${d.nodes.length} · ${JSON.stringify(d.viewBox)} · ${d.links.length}`);
}

/* ══════════ 12. attribution at DigitalPaani once the structure is confirmed ══════════ */
V.reset();
{
  const k = dp; const all = V.acceptStructure(k, { all: true });
  V.notPart(k, ids(k, 'ITP-1', 'ITP-2', 'FWTP-1', 'FWTP-2', 'PDT', 'PDP', 'SCP-1', 'SCP-2'), {});
  V.place(k, ids(k, 'UFFP-1', 'UFFP-2', 'UFBV-1'), [nodeId(k, 'UF-1')], {}); V.place(k, ids(k, 'UFFP-3', 'UFFP-4', 'UFBV-2'), [nodeId(k, 'UF-2')], {});
  V.place(k, ids(k, 'RFP-1', 'RFP-2'), ids(k, 'MBBR-1', 'MBBR-4'), {}); V.place(k, ids(k, 'FFP-1', 'FFP-2'), [nodeId(k, 'MGF')], {});
  const last = V.place(k, ids(k, 'SPFP-1', 'SPFP-2'), [nodeId(k, 'SLP')], {});
  const couldUndo = V.canUndo(k, last.token);
  safe(() => (typeof V.acceptAllFor === 'function' ? V.acceptAllFor(k, {}, { activate: false }) : null), null);
  const ub = V.undoStructure(k, last.token);
  check('undo', 'the action that confirmed the structure can be undone until the bindings pass is worked, and not after', couldUndo && !V.canUndo(k, last.token) && !ub.ok && ub.error === 'This can no longer be undone: the bindings pass has been worked since the structure was confirmed.' && V.structureDone(k), ub.error);
  const mb1 = nodeId(k, 'MBBR-1'); const types = V.issueTypesFor(k, { kind: 'up', id: mb1 });
  const cause = ((window.CTL.S.lib && window.CTL.S.lib.causes) || []).find((c) => /^All blowers OFF/i.test(c.name));
  const rep = types.length ? V.report(k, { kind: 'up', id: mb1 }, types[0].id) : { ok: false, error: 'no Issue type' };
  const cc = rep.ok && cause ? V.chooseCause(k, rep.id, cause.id) : { causedBy: null };
  const blowers = ids(k, 'MBBRAB-1', 'MBBRAB-2', 'MBBRAB-3'); const esab = ids(k, 'ESAB-1', 'ESAB-2');
  const log = rep.ok ? (V.issue(k, rep.id).log || []).map((l) => l.text) : [];
  check('attribution', 'V72-73 · at DigitalPaani "All blowers OFF" on an MBBR-1 Issue lands on an MBBR-1 blower, never an EQT blower', all.ok && last.confirmed && rep.ok && cause && blowers.includes(cc.causedBy) && !esab.includes(cc.causedBy) && log.some((t) => /^Caused by MBBRAB-\d \(Blower; takes part in MBBR-1\)$/.test(t)), `${rep.error || ''} · ${cause && cause.name} · ${tagOf(k, cc.causedBy)} · ${log.slice(-1)}`);
  check('attribution', 'a reported Issue on a unit process takes it as its subject and tells nobody while Commissioning', rep.ok && V.issue(k, rep.id).subject.kind === 'up' && V.issue(k, rep.id).subject.id === mb1 && V.issue(k, rep.id).told.length === 0);
}

/* ══════════ 13. words, determinism ══════════ */
V.reset();
{
  const texts = [];
  KEYS.forEach((k) => {
    const p = V.structurePass(k); p.groups.forEach((g) => { texts.push(g.title, g.sub, g.why); (g.rows || []).forEach((r) => texts.push(r.title, r.why, r.stateLabel)); });
    V.structureTrack(k).forEach((s) => texts.push(s.label, s.detail)); V.unitProcesses(k).forEach((u) => { texts.push(u.why, u.typeName, u.stageLabel, u.drawnFact); u.participants.forEach((x) => texts.push(x.why, x.roleLabel, x.stateLabel)); });
    V.controlGroups(k).forEach((c) => { texts.push(c.name, c.why, c.setpointText); c.memberWork.forEach((w) => texts.push(w.text)); c.warnings.forEach((w) => texts.push(w)); });
    V.activity({ plant: k }).filter((a) => a.kind === 'structure').forEach((a) => texts.push(a.text));
    V.nodes(k).forEach((n) => { const t = V.tierInfo(k, n.id); texts.push(t.chipText, t.label); });
  });
  texts.push(...V.membershipPreview(dp, [{ op: 'type', upId: nodeId(dp, 'SC'), typeId: 'screening' }]).lines);
  V.upTypes().forEach((u) => texts.push(u.name, u.stageLabel, ...u.identifiedFrom));
  const bad = badWords(texts.filter(Boolean));
  check('words', 'the words this file writes pass Alex\'s word list (no SCADA, database, machine, bare tier, rule …)', !bad.length && texts.length > 300, bad.slice(0, 4).join(' | '));
  const f1 = fingerprint(V); const twice = sha(KEYS.map((k) => JSON.stringify(V.identify(k))).join('|'));
  V.reset(); const f2 = fingerprint(V);
  const other = MODE === 'main' ? child(['--boot']) : f1;
  check('determinism', 'V72-20 · identification is the same twice, after Reset and in another boot', f1.identify === twice && f1.identify === f2.identify && !other.error && other.identify === f1.identify, `${f1.identify} · ${f2.identify} · ${other.error || other.identify}`);
  check('determinism', 'the stored structure and its changes are the same after Reset and in another boot', f1.structure === f2.structure && f1.overrides === f2.overrides && other.structure === f1.structure && other.overrides === f1.overrides && other.seq === 202 && other.sseq === 11, other.error || `${other.structure} · ${other.overrides} · ${other.seq} · ${other.sseq}`);
}

/* ══════════ 14. this file alone with core7 (before the ledger and library files) ══════════ */
if (MODE === 'main') {
  const r = child(['--alone'], { LOAD72_UPTO: 'core72-structure.js' });
  if (r.error) check('alone', 'the run with core7 and this file only finished', false, r.error);
  else r.results.forEach((x) => { results.push({ ...x, group: `alone · ${x.group}` }); if (!x.ok) fails++; });
}
if (doneAlone) {
  const tv = (k, tag) => V.tierInfo(k, nodeId(k, tag));
  check('chips', 'without the ledger file this file words its own chips: Derived, Library, Override', tv('bawal', 'V-1').chipText === 'Derived · highest of MGF-1' && tv('bawal', 'RW-1').chipText === 'Library · Submersible Pump v1' && /^Override · Tuning · Sunny Verma · 26 Sep · review by 26 Oct$/.test(tv('manesar', 'SP-1').chipText) && tv('manesar', 'SP-1').chip.small === 'Library: B', `${tv('bawal', 'V-1').chipText} | ${tv('bawal', 'RW-1').chipText} | ${tv('manesar', 'SP-1').chipText}`);
  emit({ results });
  process.exit(0);
}

report();
function report() {
  const groups = [...new Set(results.map((r) => r.group))];
  console.log(`structure72.test · ${results.length - fails}/${results.length} pass · load + boot ${loadMs} ms · total ${Date.now() - t0} ms · loaded ${L.loaded.length} files${L.missing.length ? ` (not written yet: ${L.missing.join(', ')})` : ''}`);
  for (const g of groups) {
    const rs = results.filter((r) => r.group === g); const bad = rs.filter((r) => !r.ok);
    console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${g.padEnd(24)} ${rs.length - bad.length}/${rs.length}`);
    rs.filter((r) => !r.ok || VERBOSE).forEach((r) => console.log(`       ${r.ok ? '·' : '✗'} ${r.name}${r.detail != null ? `  [${String(r.detail).slice(0, 300)}]` : ''}`));
  }
  console.log(fails ? `RESULT: FAIL · ${fails} failing` : 'RESULT: PASS');
  process.exit(fails ? 1 : 0);
}
