/* v7/8 · tests/v77.test.js — what v7/8 adds, checked on the core with no browser:
   generated tasks wait for an admin, go live keeps who and why, an alert with under a day of trial stays On trial, a noisy alert is
   acknowledged, a plant that has been Live goes live again without deciding what it ran with, the shadow run and its gate, what a
   sensor sends, the share that follows the library, and the language of the operator's text.
   Usage: TZ=Asia/Calcutta node tests/v77.test.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const A = path.join(__dirname, '..', 'assets'); const VERBOSE = process.argv.includes('-v');
const g = global; g.window = g; g.V7_NO_V6_SHELL = true; g.addEventListener = () => {}; g.removeEventListener = () => {};
const store = new Map();
g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, removeAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], style: {}, dataset: {}, innerHTML: '' });
g.document = { querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), onkeydown: null };
g.location = { hash: '#/plants', href: 'http://localhost/prototype.html#/plants' }; g.scrollTo = () => {}; g.Blob = g.Blob || function Blob() {}; if (!g.URL) g.URL = {};
for (const f of ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'structure73.js', 'nodes73.js', 'core7.js', 'calls73.js', 'decisions7.js', 'shadow77.js', 'lang77.js', 'libadd78.js', 'libtrig78.js', 'libflow7.js', 'upalert78.js', 'crit78.js', 'dyn78.js', 'sev78.js', 'cal78.js']) vm.runInThisContext(fs.readFileSync(path.join(A, f), 'utf8'), { filename: f });
const V = g.V7; const SH = g.V7SHADOW; const LG = g.V7LANG; V.boot();
const results = [];
function check(area, name, ok, detail) { results.push(!!ok); if (VERBOSE || !ok) console.log(`${ok ? '  ok  ' : '  FAIL'} [${area}] ${name}${detail ? ' — ' + detail : ''}`); }
const DAY = 24 * 60;

/* generated tasks wait for an admin */
const r0 = V.autoSetup('digitalpaani'); const lr = V.libraryReview('digitalpaani'); const props = [].concat(...lr.map((r) => r.proposals)).filter((p) => !p.blockedBy);
check('drafts', 'set-up by default puts the alerts On trial and accepts no task', r0.ok && r0.alerts > 0 && r0.tasks === 0 && r0.drafted > 0, JSON.stringify(r0));
check('drafts', 'every alert that can be used is decided, and every task still waits', props.filter((p) => p.kind === 'alert').every((p) => p.decided) && props.filter((p) => p.kind !== 'alert').every((p) => !p.decided));
const cl0 = V.checklist('digitalpaani'); const lib0 = cl0.blockers.find((b) => b.id === 'library');
check('drafts', 'the waiting tasks block go live, counted in lines', !!lib0 && lib0.count === cl0.tracks.library.lines && lib0.count <= r0.drafted, lib0 && lib0.text);
check('drafts', 'Activity says the tasks were drafted, not accepted', /drafted from the library/.test(V.activity({ plant: 'digitalpaani', limit: 1 })[0].text));
const acc = V.acceptAllFor('digitalpaani', {});
check('drafts', 'accepting them is one action by a person', acc.ok && acc.tasks === r0.drafted && !V.checklist('digitalpaani').blockers.some((b) => b.id === 'library'), `${acc.tasks} tasks`);

/* the shadow run */
V.reset(); V.autoSetup('vedanta');
check('shadow', 'Vedanta and DigitalPaani have alerting today; Manesar never had a shadow run here', SH.has('vedanta') && SH.open('vedanta') && SH.has('digitalpaani') && !SH.has('manesar'));
const g0 = SH.gate('vedanta'); const rows0 = SH.rows('vedanta');
check('shadow', 'the gate needs 14 days and nothing that matters unexplained', g0.need === 14 && !g0.pass && g0.days > 5 && g0.days < 7 && g0.unexplained > 0, g0.text);
check('shadow', 'every row is matched, differs in severity, or was raised by one side only', rows0.length > 100 && rows0.every((x) => ['matched', 'severity', 'ctl', 'legacy'].includes(x.outcome)) && rows0.some((x) => x.outcome === 'legacy') && rows0.some((x) => x.outcome === 'ctl') && rows0.some((x) => x.outcome === 'severity'));
check('shadow', 'only a Major or Emergency that CloseTheLoop missed or rated lower holds go live', rows0.filter((x) => x.blocks).every((x) => x.serious && (x.outcome === 'legacy' || x.outcome === 'severity')) && rows0.filter((x) => x.outcome === 'ctl' || x.outcome === 'matched').every((x) => !x.blocks));
check('shadow', 'the gate blocks go live from the one checklist', V.checklist('vedanta').blockers.some((b) => b.id === 'shadow') && !V.checklist('vedanta').canGoLive);
const rl = SH.rules('vedanta');
check('shadow', 'legacy rules are matched to alerts, and the unmatched ones are named', rl.mapped.length > 5 && rl.unmapped.length === 2 && rl.unmapped.every((u) => u.rule && u.why) && rl.newCover.length >= 1);
const blk = rows0.filter((x) => x.blocks);
check('shadow', 'a real gap needs a note', !SH.setReason('vedanta', blk[0].id, 'gap', '').ok);
check('shadow', 'a real gap still holds go live until it is fixed', SH.setReason('vedanta', blk[0].id, 'gap', 'Legacy calls Major earlier').ok && SH.rows('vedanta').find((x) => x.id === blk[0].id).blocks);
check('shadow', 'marking it fixed asks for 7 more days', SH.markFixed('vedanta', blk[0].id).ok && !SH.rows('vedanta').find((x) => x.id === blk[0].id).blocks && SH.gate('vedanta').sinceFix != null);
blk.slice(1).forEach((x) => SH.setReason('vedanta', x.id, 'limit', 'On purpose'));
check('shadow', 'with every reason given, only the days are left', SH.gate('vedanta').unexplained === 0 && !SH.gate('vedanta').pass);
V.advance(9 * DAY); SH.rows('vedanta').filter((x) => x.blocks).forEach((x) => SH.setReason('vedanta', x.id, 'hold', 'No hold time in legacy'));
const g1 = SH.gate('vedanta');
check('shadow', 'after 14 days and 7 days since the fix the gate is through', g1.pass && g1.days >= 14 && g1.sinceFix >= 7, g1.text);

/* go live keeps who and why */
const pv = V.goLivePreview('vedanta');
check('go live', 'the checklist lets it through', pv.checklist.canGoLive, pv.checklist.whyNot);
check('go live', 'it needs a reason', V.goLive('vedanta').need === 'reason' && V.plant('vedanta').state === 'commissioning');
check('go live', 'a noisy alert has to be acknowledged', pv.noisy.length >= 1 && V.goLive('vedanta', { reason: 'Gate through' }).need === 'noisy' && V.plant('vedanta').state === 'commissioning', pv.noisy.map((x) => x.name).join());
const gl = V.goLive('vedanta', { reason: 'Gate through, reviewed with the plant team', ackNoisy: true, who: 'Global Admin' }); const pl = V.plant('vedanta'); const a0 = V.activity({ plant: 'vedanta', kind: 'golive', limit: 1 })[0];
check('go live', 'who, when and why are kept on the plant and in Activity', gl.ok && pl.state === 'live' && pl.wentLive && pl.wentLive.who === 'Global Admin' && /reviewed with the plant team/.test(pl.wentLive.reason) && a0.who === 'Global Admin' && /Why: Gate through/.test(a0.text) && /Seen as noisy/.test(a0.text));
check('go live', 'the shadow run closes in the same entry', /Shadow run closed/.test(a0.text) && !SH.open('vedanta'));

/* an alert with under a day of trial stays On trial */
V.reset(); V.autoSetup('vedanta'); SH.rows('vedanta').filter((x) => x.blocks).forEach((x) => SH.setReason('vedanta', x.id, 'limit', 'x')); V.advance(9 * DAY); SH.rows('vedanta').filter((x) => x.blocks).forEach((x) => SH.setReason('vedanta', x.id, 'limit', 'x'));
const fresh = V.alerts('vedanta').find((a) => /MLSS low/.test(a.name)); V.setAlertState('vedanta', fresh.id, 'off'); V.setAlertState('vedanta', fresh.id, 'trial');
const pv2 = V.goLivePreview('vedanta');
check('trial', 'an alert put On trial moments ago is named', pv2.untried.length === 1 && pv2.untried[0].alertId === fresh.id && /stays On trial for 7 more days/.test(pv2.untriedText));
const gl2 = V.goLive('vedanta', { reason: 'Gate through', ackNoisy: true });
check('trial', 'at go live it stays On trial for 7 days, while the rest turn On', gl2.ok && V.alertState('vedanta', fresh.id) === 'trial' && V.alerts('vedanta').filter((a) => a.id !== fresh.id && a.state !== 'off' && a.state !== 'draft').every((a) => a.state === 'on'));
V.advance(7 * DAY + 60);
check('trial', 'and turns On when the 7 days are over', V.alertState('vedanta', fresh.id) === 'on');

/* a plant that has been Live */
V.reset();
check('again', 'Manesar has been Live', V.plant('manesar').wasLive === true && V.plant('digitalpaani').wasLive === false);
check('again', 'returning it needs a reason', !V.returnToCommissioning('manesar', '').ok && V.returnToCommissioning('manesar', 'Aeration grid rebuild', 'Global Admin').ok);
const clM = V.checklist('manesar');
check('again', 'what it ran with undecided is a gap, not a blocker', !clM.blockers.some((b) => b.id === 'library') && clM.gaps.some((x) => x.id === 'library') && !clM.blockers.some((b) => b.id === 'shadow'), clM.blockers.map((b) => b.id).join());

/* what a sensor sends */
V.reset(); const sDo = V.sensors('manesar', 'at2').find((s) => /oxygen/i.test(s.name));
check('sensor', 'a reading has a valid range and how often it is expected', Array.isArray(sDo.valid) && sDo.reportEvery === 15);
check('sensor', 'the range cannot cut off a limit', !V.setSensorFacts('manesar', sDo.id, { valid: [1.5, 6] }).ok);
const sf = V.setSensorFacts('manesar', sDo.id, { valid: [0, 8], reportEvery: 5 }); const sDo2 = V.sensors('manesar', 'at2').find((s) => s.id === sDo.id);
check('sensor', 'both are saved with the reading and logged', sf.ok && sf.changed && sDo2.valid[1] === 8 && sDo2.reportEvery === 5 && /valid range/.test(V.activity({ plant: 'manesar', limit: 1 })[0].text));

/* the share that follows the library */
const fsM = V.followShare('manesar');
check('follow', 'Manesar: its own values against the ones that follow', fsM.total === fsM.follows + fsM.own && fsM.own > 0 && fsM.pct === Math.round(100 * fsM.follows / fsM.total) && fsM.target === 80, JSON.stringify(fsM));

/* the language of the operator's text */
check('language', 'English, Hindi, Marathi and Tamil', LG.LANGS.map((l) => l.id).join() === 'en,hi,mr,ta' && LG.cur() === 'en' && LG.t('All quiet') === null);
['hi', 'mr', 'ta'].forEach((l) => {
  LG.set(l); const cv = LG.coverage(l);
  check('language', `${l}: card words, names and six flows`, LG.t('All quiet') && LG.t('All quiet') !== 'All quiet' && LG.t('Is the blower running?') && LG.t('Blower · Critical').indexOf(' · ') > 0 && LG.t('In Major') && LG.t('Due: Weekly backwash') && cv.flows === 6 && cv.flowsAll > 300);
  check('language', `${l}: every step of a translated flow has its text, and an untranslated step has none`, g.CTL.S.lib.flows.filter((f) => cv.ids.includes(f.id)).every((f) => f.steps.every((s) => LG.t(s.text))) && LG.t('Soak for 60 minutes') === null);
});
check('language', 'a flow is a draft until someone marks it reviewed', LG.flowState('f_lowdo', 'hi') === 'draft' && LG.review('f_lowdo', 'hi') && LG.flowState('f_lowdo', 'hi') === 'reviewed' && LG.flowState('f_cip', 'hi') === 'none' && LG.flowState('f_lowdo', 'mr') === 'draft');
LG.set('en');

/* v7/8: adding to a library type */
V.reset(); const LA = g.V7LIBADD; const t0 = V.libType('SOFTNER');
check('add', 'only readings taken on the equipment are offered, and not ones the type has', LA.readingsFor('SOFTNER').some((r) => r.name === 'Level') && !LA.readingsFor('SOFTNER').some((r) => r.name === 'Outlet hardness') && !LA.readingsFor('BLW').some((r) => r.name === 'Motor current'));
check('add', 'a reading on a pipe is refused', !LA.addReading('SOFTNER', 'Outlet hardness').ok);
check('add', 'a reading is added to the type', LA.addReading('SOFTNER', 'Level').ok && V.libType('SOFTNER').readings.length === t0.readings.length + 1);
check('add', 'an alert needs limits in order', !LA.addAlert('SOFTNER', { reading: 'Level', dir: 'below', name: 'Brine level low', limits: { minor: 15, major: 30 } }).ok && !LA.addAlert('SOFTNER', { reading: 'Level', dir: 'below', name: 'Brine level low', limits: {} }).ok);
check('add', 'an alert is added with its limits and is not next phase', LA.addAlert('SOFTNER', { reading: 'Level', dir: 'below', name: 'Brine level low', limits: { minor: 30, major: 15 }, hold: 5, clear: 10 }).ok && V.libType('SOFTNER').alerts.some((a) => a.name === 'Brine level low' && a.bands.minor === 30 && a.bands.major === 15 && !a.nextPhase));
check('add', 'a plant with the type sees it as a proposal, not as something already on', [].concat(...V.libraryReview('bawal').map((r) => r.proposals)).some((p) => /Brine level low/.test(p.name) && !p.decided));
check('add', 'no task more often than once a day', !LA.addTask('SOFTNER', { name: 'Look at it', workType: 'routine', every: { n: 4, unit: 'hour' } }).ok && LA.addTask('SOFTNER', { name: 'Check the brine level', workType: 'pm', every: { n: 1, unit: 'week' } }).ok && V.libType('SOFTNER').schedules.some((x) => x.name === 'Check the brine level'));
check('add', 'a reading with an alert on it is not removed first', !LA.remove('SOFTNER', 'reading', 'Level').ok && LA.remove('SOFTNER', 'alert', 'Brine level low').ok && LA.remove('SOFTNER', 'reading', 'Level').ok);
const i0 = V.libType('cass').issues.length; const known = LA.issuesFor('cass');
check('add', 'a problem the library knows for another type can be given to this one, with its diagnostic and causes', known.length > 0 && LA.addIssue('cass', { existingId: known[0].id }).ok && V.libType('cass').issues.length === i0 + 1 && V.libType('cass').issues.some((i) => i.id === known[0].id) && !LA.addIssue('cass', { existingId: known[0].id }).ok);
check('add', 'a new problem needs a name, and one found by an alert needs the alert', !LA.addIssue('cass', { name: ' ' }).ok && !LA.addIssue('cass', { name: 'Decanter arm stuck', foundBy: 'sensor', alert: 'No such alert' }).ok && LA.addIssue('cass', { name: 'Decanter arm stuck', foundBy: 'visual' }).ok && V.libType('cass').issues.some((i) => i.name === 'Decanter arm stuck' && i.foundBy.join() === 'visual'));
check('add', 'both are taken off again, and the known problem stays on its own types', LA.remove('cass', 'issue', 'Decanter arm stuck').ok && LA.remove('cass', 'issue', known[0].name).ok && V.libType('cass').issues.length === i0 && g.ISSUES.some((i) => i.id === known[0].id && i.homeTypes.length > 0 && !i.homeTypes.includes('Cyclic activated sludge system')));
check('add', 'what shipped with the library cannot be removed here', !LA.remove('BLW', 'alert', 'Motor current high').ok);
V.reset();
check('add', 'a reset puts the library back as shipped', V.libType('SOFTNER').readings.length === t0.readings.length && V.libType('SOFTNER').schedules.length === t0.schedules.length);

/* v7/8: what a range triggers is set on the type, and plants follow it */
V.reset(); V.autoSetup('vedanta'); const LT = g.V7LIBTRIG; const vb = V.sensors('vedanta').find((x) => x.name === 'Motor current' && x.eqTag === 'BL-1'); const m0 = V.lineWork('manesar').length;
check('trigger', 'Emergency always opens an issue, and a task needs a name', !LT.set('BLW', 'Motor current', 'above', 'emergency', { name: 'x' }).ok && !LT.set('BLW', 'Motor current', 'above', 'caution', { name: ' ' }).ok);
const pvT = LT.preview('BLW', 'Motor current', 'above', 'caution');
check('trigger', 'the type says which plant readings a trigger reaches before it is saved', pvT.follow.some((x) => x.key === 'vedanta' && x.tag === 'BL-1') && pvT.own.some((x) => x.key === 'manesar'), JSON.stringify(pvT));
const st1 = LT.set('BLW', 'Motor current', 'above', 'caution', { name: 'Clean the intake filter' });
check('trigger', 'a plant reading that follows the library gets the task', st1.ok && st1.reached >= 1 && V.lineWork('vedanta').some((w) => w.eqTag === 'BL-1' && w.band === 'caution' && w.name === 'Clean the intake filter') && LT.source('vedanta', vb.id, 'above', 'caution') === 'lib');
check('trigger', 'a plant that set its own task keeps it', V.lineWork('manesar').length === m0 && V.lineWork('manesar').some((w) => w.eqTag === 'BL-1' && w.name !== 'Clean the intake filter'));
check('trigger', 'renaming it on the type renames it at the plant', LT.set('BLW', 'Motor current', 'above', 'caution', { name: 'Clean the intake filters' }).ok && V.lineWork('vedanta').some((w) => w.name === 'Clean the intake filters'));
check('trigger', 'a plant can choose an issue after all, and keeps that', V.setLineWork('vedanta', vb.id, 'above', 'caution', { name: null }).ok && V.lineWork('vedanta').length === 0 && LT.source('vedanta', vb.id, 'above', 'caution') === 'own' && !LT.sync() && V.lineWork('vedanta').length === 0);
check('trigger', 'and can go back to the library', LT.backToLib('vedanta', vb.id, 'above', 'caution').ok && V.lineWork('vedanta').length === 1 && LT.source('vedanta', vb.id, 'above', 'caution') === 'lib');
check('trigger', 'taking it off the type takes it off the plants that follow', LT.set('BLW', 'Motor current', 'above', 'caution', null).ok && V.lineWork('vedanta').length === 0 && V.lineWork('manesar').length === m0);
V.reset();

/* v7/8: a trigger goes through the draft, and a plant's own trigger is a deviation */
V.reset(); V.autoSetup('vedanta'); const vb2 = V.sensors('vedanta').find((x) => x.name === 'Motor current' && x.eqTag === 'BL-1'); const ovM0 = V.overrides({ plant: 'manesar' }).length;
check('draft', 'Emergency cannot raise a task, in the draft either', !V.editLib('BLW', { trigger: { reading: 'Motor current', dir: 'above', band: 'emergency', name: 'x' } }).ok);
const e1 = V.editLib('BLW', { trigger: { reading: 'Motor current', dir: 'above', band: 'caution', name: 'Clean the intake filter' } });
check('draft', 'saving a trigger on a type makes a draft, and reaches no plant', e1.ok && e1.draft.diffs.some((d) => d.kind === 'trigger' && d.band === 'caution' && d.to === 'Clean the intake filter') && V.lineWork('vedanta').length === 0 && Object.keys(LT.get('BLW', 'Motor current', 'above')).length === 0 && LT.get('BLW', 'Motor current', 'above', { draft: true }).caution.draft === true);
const wl1 = V.whereItLands('BLW'); const wv = wl1.plants.find((p) => p.key === 'vedanta'); const wm = wl1.plants.find((p) => p.key === 'manesar');
check('draft', 'Where it lands names the reading that follows and the one that keeps its own', wv.follows.some((x) => /BL-1 · Motor current Caution above triggers/.test(x.what) && x.from === 'An issue' && /Clean the intake filter/.test(x.to)) && wm.changedHere.some((x) => /triggers/.test(x.what) && /Clean the blower intake filters/.test(x.plantValue)), wl1.text);
check('draft', 'setting it back to what is published empties the draft', V.editLib('BLW', { trigger: { reading: 'Motor current', dir: 'above', band: 'caution', name: null } }).ok && V.libDraft('BLW') === null);
V.editLib('BLW', { trigger: { reading: 'Motor current', dir: 'above', band: 'caution', name: 'Clean the intake filter' } });
check('draft', 'publishing needs a note', !V.publish('BLW', {}).ok && V.lineWork('vedanta').length === 0);
const pb = V.publish('BLW', { note: 'Filters choke before the current limit is reached' });
check('draft', 'publishing puts it on the type and on the plant that follows', pb.ok && LT.get('BLW', 'Motor current', 'above').caution.name === 'Clean the intake filter' && V.lineWork('vedanta').some((w) => w.eqTag === 'BL-1' && w.name === 'Clean the intake filter') && V.libDraft('BLW') === null && V.libVersion('BLW') === 2);
check('draft', 'each plant it reached has a note in its Activity', /Library: Blower v2 published/.test(V.activity({ plant: 'vedanta', kind: 'library', limit: 1 })[0].text));
const ovM = V.overrides({ plant: 'manesar' }).filter((o) => o.target.kind === 'trigger');
check('deviation', 'a task a plant already had is listed as a deviation, its reason not recorded', V.overrides({ plant: 'manesar' }).length === ovM0 + 1 && ovM.length === 1 && ovM[0].reason === 'unrecorded' && /Motor current.*Caution above triggers/.test(ovM[0].what) && /Clean the blower intake filters/.test(ovM[0].plantValue) && /Clean the intake filter/.test(ovM[0].libValue) && ovM[0].tag === 'BL-1', ovM.map((o) => o.what + ' ' + o.plantValue).join());
check('deviation', 'a plant that follows has none', V.overrides({ plant: 'vedanta' }).filter((o) => o.target.kind === 'trigger').length === 0);
check('deviation', 'choosing an issue at a plant is a deviation with its reason', V.setLineWork('vedanta', vb2.id, 'above', 'caution', { name: null, reason: 'tuned', note: 'No spare filters on site yet' }).ok && V.overrides({ plant: 'vedanta' }).some((o) => o.target.kind === 'trigger' && o.plantValue === 'An issue' && o.reason === 'tuned' && o.note === 'No spare filters on site yet' && o.state === 'ok'));
const ovV = V.overrides({ plant: 'vedanta' }).find((o) => o.target.kind === 'trigger');
check('deviation', 'Back to the library value sends it back and ends the deviation', V.revert(ovV.id).ok && V.lineWork('vedanta').some((w) => w.name === 'Clean the intake filter') && LT.source('vedanta', vb2.id, 'above', 'caution') === 'lib' && V.overrides({ plant: 'vedanta' }).filter((o) => o.target.kind === 'trigger').length === 0);
V.editLib('BLW', { trigger: { reading: 'Motor current', dir: 'above', band: 'caution', name: 'Clean the blower intake filters' } }); V.publish('BLW', { note: 'One name for the same job' });
check('deviation', 'when the library comes to say the same, the deviation reads as the same', V.overrides({ plant: 'manesar' }).find((o) => o.target.kind === 'trigger').state === 'same');
V.editLib('BLW', { trigger: { reading: 'Motor current', dir: 'above', band: 'caution', name: null } }); V.publish('BLW', { note: 'Back to an issue' });
check('deviation', 'when the library stops setting it, nothing differs any more', V.overrides({ plant: 'manesar' }).filter((o) => o.target.kind === 'trigger').length === 0 && V.lineWork('manesar').some((w) => w.eqTag === 'BL-1') && V.lineWork('vedanta').length === 0);
V.reset();

/* which flow a problem or a task uses, chosen on the library type */
V.reset(); { const LF = g.V7LIBFLOW; const bl = V.libType('BLW'); const is0 = bl.issues[0]; const diag0 = is0.flowId;
  const o = LF.options('task', 'BLW'); const od = LF.options('issue', 'BLW'); const other = o.rest[0]; const was = LF.flowOf('task', 'BLW', 'Bearing service');
  check('flow', 'a task says which flow it follows, a problem which diagnostic it starts', !!was && was.id === 'f_blower_pm' && LF.flowOf('issue', 'BLW', is0.id).id === diag0);
  check('flow', 'the choices are task flows for a task and diagnostic flows for a problem, the type\'s own first', o.near.length > 0 && o.near.every((f) => f.forTypes.includes('Blower')) && o.near.concat(o.rest).every((f) => f.kind !== 'diagnostic' && f.use !== 'fix') && od.near.concat(od.rest).every((f) => f.kind === 'diagnostic'));
  check('flow', 'a task cannot take a diagnostic flow, nor a problem a task flow', !LF.set('task', 'BLW', 'Bearing service', diag0).ok && !LF.set('issue', 'BLW', is0.id, other.id).ok && LF.flowOf('task', 'BLW', 'Bearing service').id === was.id);
  const a0 = V.activity({ plant: 'manesar', kind: 'library' }).length; const r = LF.set('task', 'BLW', 'Bearing service', other.id);
  check('flow', 'choosing a flow for a task changes the type, and the plants that followed follow', r.ok && r.changed && r.plants.includes('manesar') && V.libType('BLW').schedules.find((x) => x.name === 'Bearing service').flowId === other.id && V.tasks('manesar').filter((t) => t.name === 'Bearing service').every((t) => t.flowId === other.id) && V.tasks('manesar').some((t) => t.name === 'Bearing service'));
  check('flow', 'each plant it reached has a note in its Activity', V.activity({ plant: 'manesar', kind: 'library' }).length === a0 + 1 && /Bearing service.*now follows the flow/.test(V.activity({ plant: 'manesar', kind: 'library', limit: 1 })[0].text));
  check('flow', 'choosing the same flow again changes nothing', LF.set('task', 'BLW', 'Bearing service', other.id).changed === false);
  check('flow', 'a task that came with its steps cannot be left with none', (() => { const x = V.libType('BLW').schedules.find((y) => y.generalTaskId); return !!x && !LF.set('task', 'BLW', x.name, null).ok; })());
  const m0 = LF.missing('BLW').n; const ri = LF.set('issue', 'BLW', is0.id, null);
  check('flow', 'a problem can be left without a diagnostic, and the type then says what is missing', ri.ok && V.libType('BLW').issues[0].flowId == null && LF.missing('BLW').n === m0 + 1 && LF.missing('BLW').issues[0] === is0.name);
  check('flow', 'a problem takes another diagnostic', LF.set('issue', 'BLW', is0.id, od.rest[0].id).ok && V.libType('BLW').issues[0].flowId === od.rest[0].id && LF.missing('BLW').n === m0);
  check('flow', 'some types have a task without a flow, and the count is per type', V.libTypes().filter((t) => LF.missing(t.code).n > 0).length > 0 && LF.missing('BLW').tasks.length === 0);
  V.reset();
  check('flow', 'a reset puts every flow back', LF.flowOf('task', 'BLW', 'Bearing service').id === 'f_blower_pm' && V.libType('BLW').issues[0].flowId === diag0 && V.tasks('manesar').filter((t) => t.name === 'Bearing service').every((t) => t.flowId === 'f_blower_pm')); }

/* alerts across a unit process: kinds of reading wherever they sit, clubbed, offered at each plant */
V.reset(); { const UA = g.V7UPALERT; const mo = UA.offers('manesar'); const by = (tag, re) => UA.offers('manesar').find((o) => o.upTag === tag && re.test(o.name));
  check('process', 'an equipment type takes no reading from outside itself; a unit process reads across the step', !UA.saveAlert('BLW', { name: 'x', when: [{ reading: 'Dissolved oxygen', dir: 'below', limit: 1 }] }).ok && UA.alerts('activated_sludge').length >= 3 && UA.alerts('BLW').length === 0);
  const hdr = by('AT-1', /header/);
  check('process', 'a plant is offered an alert that reads a pipe and the tank together', !!hdr && !hdr.skipped && hdr.onPipe && hdr.conds.length === 2 && hdr.conds[0].found.length === 2 && hdr.conds[0].found.every((x) => x.onPipe) && hdr.conds[1].found.length === 1 && !hdr.conds[1].found[0].onPipe);
  const ras = by('AT-1', /Return flow/); const eq = by('EQ-1', /Level high/);
  check('process', 'an alert whose kind of reading nothing in the unit process sends is skipped, and says which', ras.skipped && ras.missing.join() === 'Flow' && eq.skipped && eq.missing.join() === 'Motor current' && !UA.decide('manesar', ras.pid, 'applied').ok);
  check('process', 'whether it would fire is worked out on the latest readings', by('AT-2', /Low DO/).now.fires === true && by('AT-1', /Low DO/).now.fires === false && by('MGF-1', /choking/).now.fires === true);
  const a0 = V.activity({ plant: 'manesar' }).length;
  check('process', 'a person applies it or leaves it out, and can undo', !UA.decide('manesar', hdr.pid, 'applied').ok && UA.pick('manesar', hdr.pid, hdr.conds.findIndex((c) => c.found.length > 1), hdr.conds.find((c) => c.found.length > 1).found[0].id).ok && UA.offer('manesar', hdr.pid).conds.find((c) => c.found.length > 1).use.length === 1 && UA.decide('manesar', hdr.pid, 'applied').ok && UA.offer('manesar', hdr.pid).state === 'applied' && UA.decide('manesar', by('AT-1', /Low DO/).pid, 'left').ok && by('AT-1', /Low DO/).state === 'left' && UA.decide('manesar', by('AT-1', /Low DO/).pid, null).ok && by('AT-1', /Low DO/).state === null && V.activity({ plant: 'manesar' }).length === a0 + 4);
  const ve = UA.offers('vedanta').find((o) => o.upTag === 'EQ-1' && /Level high/.test(o.name)); const amps = ve.conds[1].found;
  check('process', 'the same kind of reading on several machines is found on each', amps.length === 3 && ve.conds[1].of === 'all');
  const e1 = UA.edit('vedanta', ve.pid, { match: 'all', band: 'major', hold: 10, when: [{ reading: 'Level', dir: 'above', limit: 80, of: 'any' }, { reading: 'Motor current', dir: 'below', limit: 1, of: 'all', use: amps.filter((x) => !/MX/.test(x.tag)).map((x) => x.id) }, { reading: 'pH', dir: 'above', limit: 9, of: 'any' }] });
  const ve2 = UA.offer('vedanta', ve.pid);
  check('process', 'at the plant its limit is changed, its sensors are chosen, and another reading from the unit process is added', e1.ok && ve2.own && ve2.conds.length === 3 && ve2.conds[0].limit === 80 && ve2.conds[1].use.length === 2 && UA.alerts('equalization')[0].when[0].limit === 85 && UA.alerts('equalization')[0].when.length === 2);
  check('process', 'a reading the unit process does not send cannot be added there, and a limit must fit the reading', !UA.edit('vedanta', ve.pid, { when: [{ reading: 'Flow', dir: 'below', limit: 5 }] }).ok && !UA.edit('vedanta', ve.pid, { when: [{ reading: 'Level', dir: 'above', limit: 400 }] }).ok);
  check('process', "it can go back to the library's", UA.edit('vedanta', ve.pid, null).ok && !UA.offer('vedanta', ve.pid).own && UA.offer('vedanta', ve.pid).conds.length === 2);
  const n0 = UA.alerts('activated_sludge').length;
  check('process', 'a task or a calibration needs its flow, of the right kind, and never at Emergency', !UA.saveAlert('activated_sludge', { name: 'T', when: [{ reading: 'MLSS', dir: 'above', limit: 5000 }], starts: { kind: 'task' } }).ok && !UA.saveAlert('activated_sludge', { name: 'T', when: [{ reading: 'MLSS', dir: 'above', limit: 5000 }], starts: { kind: 'calibration', flowId: 'f_lowdo' } }).ok && !UA.saveAlert('activated_sludge', { name: 'T', band: 'emergency', when: [{ reading: 'MLSS', dir: 'above', limit: 5000 }], starts: { kind: 'task', flowId: 'f_backwash' } }).ok);
  const sv = UA.saveAlert('activated_sludge', { name: 'High MLSS with the header pressure up', match: 'all', band: 'minor', hold: 20, when: [{ reading: 'MLSS', dir: 'above', limit: 4500 }, { reading: 'Line pressure', dir: 'above', limit: 0.7 }], starts: { kind: 'calibration', flowId: 'f_do_cal' } });
  check('process', 'the Global Admin clubs several kinds of reading into one alert that leads to one flow, and plants are offered it', sv.ok && UA.alerts('activated_sludge').length === n0 + 1 && UA.offers('manesar').filter((o) => o.alert.id === sv.alert.id).length === 2 && UA.offers('manesar').filter((o) => o.alert.id === sv.alert.id).every((o) => !o.skipped && o.starts.kind === 'calibration'));
  check('process', 'an alert a plant applied cannot be removed from the library; one nobody took can', !UA.removeAlert('activated_sludge', hdr.alert.id).ok && UA.removeAlert('activated_sludge', sv.alert.id).ok && UA.alerts('activated_sludge').length === n0);
  V.reset(); check('process', 'a reset puts the library and the plants back', UA.offers('manesar').every((o) => !o.state && !o.own) && UA.alerts('activated_sludge').length === n0); }

/* two issues on the same reading; criticality timelines; a unit process's own criticality */
V.reset(); { const UA = g.V7UPALERT; const CR = g.V7CRIT; const LA = g.V7LIBADD;
  const a1 = UA.saveAlert('BLW', { name: 'Overload', when: [{ reading: 'Motor current', dir: 'above', limit: 5 }], band: 'major', hold: 5, starts: { kind: 'issue' } });
  const a2 = UA.saveAlert('BLW', { name: 'Bearing drag', when: [{ reading: 'Motor current', dir: 'above', limit: 4 }], band: 'minor', hold: 30, starts: { kind: 'issue' } });
  check('same reading', 'two alerts on the same reading of an equipment type, each with its own name and severity', a1.ok && a2.ok && UA.alerts('BLW').length === 2 && UA.alerts('BLW').every((a) => a.when[0].reading === 'Motor current'));
  check('same reading', 'an equipment type reads only what sits on it', !UA.saveAlert('BLW', { name: 'x', when: [{ reading: 'Dissolved oxygen', dir: 'below', limit: 1 }] }).ok);
  const mo = UA.offers('manesar').filter((o) => o.eq); const one = mo.find((o) => o.upTag === 'BL-1' && o.name === 'Overload');
  check('same reading', 'each plant is offered both, per piece of equipment, on the sensors of that equipment only', mo.length === 4 && !!one && !one.skipped && one.conds[0].found.length === 1 && !one.onPipe);
  check('same reading', 'a person applies one and leaves the other; an applied one cannot be removed from the library', UA.decide('manesar', one.pid, 'applied').ok && UA.offer('manesar', one.pid).state === 'applied' && !UA.removeAlert('BLW', a1.alert.id).ok && UA.removeAlert('BLW', a2.alert.id).ok);
  check('same reading', 'two alerts across a unit process may watch the same kinds of reading', UA.saveAlert('mbbr', { name: 'Low DO, second issue', when: [{ reading: 'Dissolved oxygen', dir: 'below', limit: 1 }], band: 'major', hold: 10, starts: { kind: 'issue' } }).ok && UA.alerts('mbbr').filter((a) => a.when.some((c) => c.reading === 'Dissolved oxygen')).length >= 2);
  V.reset();
  check('criticality', 'the library ships one timeline per criticality, the tighter the more critical', ['A', 'B', 'C'].every((t) => CR.lib(t).remind > 0) && CR.lib('A').lead < CR.lib('B').lead && CR.lib('B').lead < CR.lib('C').lead);
  check('criticality', 'a timeline must be in order and above zero', !CR.setLib('A', { remind: 2, repeat: 2, lead: 1, senior: 8 }).ok && !CR.setLib('A', { remind: 1, repeat: 0, lead: 4, senior: 8 }).ok && !CR.setLib('A', { remind: 1, repeat: 1, lead: 9, senior: 8 }).ok);
  check('criticality', 'the library changes it once and every plant that follows has it', CR.setLib('A', { remind: 0.5, repeat: 1, lead: 2, senior: 6 }).ok && CR.plant('manesar', 'A').lead === 2 && !CR.plant('manesar', 'A').own && CR.plant('vedanta', 'A').senior === 6);
  check('criticality', 'a plant keeps its own, the library and the other plants are left alone, and it can go back', CR.setPlant('manesar', 'A', { remind: 1, repeat: 1, lead: 3, senior: 5 }).ok && CR.plant('manesar', 'A').own && CR.plant('manesar', 'A').lead === 3 && CR.lib('A').lead === 2 && !CR.plant('vedanta', 'A').own && CR.setLib('A', { remind: 0.5, repeat: 1, lead: 4, senior: 6 }).ok && CR.plant('manesar', 'A').lead === 3 && CR.setPlant('manesar', 'A', null).ok && CR.plant('manesar', 'A').lead === 4);
  const u = V.structure('manesar').ups.find((x) => x.members.length || true); const t0 = CR.upTier('manesar', u.id); const other = t0.tier === 'A' ? 'B' : 'A'; const e0 = V.equipment('manesar').map((e) => e.id + e.typeTier).join();
  check('criticality', 'a unit process starts on its library type\'s criticality and a plant changes it', !t0.own && t0.tier === t0.lib && CR.setUpTier('manesar', u.id, other).ok && CR.upTier('manesar', u.id).tier === other && CR.upTier('manesar', u.id).own);
  check('criticality', 'the type\'s own criticality is untouched by it', V.equipment('manesar').map((e) => e.id + e.typeTier).join() === e0);
  check('criticality', 'a piece of equipment knows the unit processes it takes part in', CR.upsOfEq('manesar', 'at2').length >= 1 && CR.setUpTier('manesar', u.id, null).ok && !CR.upTier('manesar', u.id).own);
  V.reset(); check('criticality', 'a reset puts all of it back', CR.lib('A').lead === CR.DEF.A.lead && !CR.plant('manesar', 'A').own && UA.alerts('BLW').length === 0); }

/* formulas at four levels, the sensor chosen at the plant, and calculated values */
V.reset(); { const UA = g.V7UPALERT; const DY = g.V7DYN;
  const ga = UA.saveAlert('@group', { name: 'Both of the set stopped', match: 'all', when: [{ reading: 'Trip contact', dir: 'above', limit: null, of: 'all' }], band: 'major', hold: 5, starts: { kind: 'issue' } });
  const pa = UA.saveAlert('@plant', { name: 'Low pressure with a pump on', match: 'all', when: [{ reading: 'Line pressure', dir: 'below', limit: 1 }, { reading: 'Motor current', dir: 'above', limit: 1 }], band: 'major', hold: 5, starts: { kind: 'issue' } });
  const go = UA.offers('manesar').filter((o) => o.sk === 'group'); const po = UA.offers('manesar').find((o) => o.sk === 'plant');
  check('levels', 'an alert is written for every control group, and each reads only its own members', ga.ok && go.length === 1 && go[0].upTag === 'Air Blowers' && go[0].conds[0].found.length >= 1 && go[0].conds[0].found.every((x) => ['BL-1', 'BL-2'].includes(x.eqTag)));
  check('levels', 'an alert is written for the plant as a whole, and may read any sensor there', pa.ok && !!po && po.conds[0].found.length >= 2 && po.conds[1].found.length >= 1);
  check('levels', 'with several sensors of a kind it waits for a person to choose', po.choose && !UA.decide('manesar', po.pid, 'applied').ok && po.conds[0].choose);
  po.conds.forEach((c, i) => { if (c.found.length > 1) UA.pick('manesar', po.pid, i, c.found[0].id); }); const po2 = UA.offer('manesar', po.pid);
  check('levels', 'the exact sensor is chosen from that kind only, and then it can be applied', !po2.choose && po2.conds[0].use.length === 1 && po2.conds[0].use[0] === po.conds[0].found[0].id && !UA.pick('manesar', po.pid, 0, po.conds[1].found[0].id).ok && UA.decide('manesar', po.pid, 'applied').ok);
  check('levels', 'any one, or every one, may be chosen instead of one sensor', UA.pick('manesar', po.pid, 0, 'all').ok && UA.offer('manesar', po.pid).conds[0].of === 'all' && UA.offer('manesar', po.pid).conds[0].use.length === po.conds[0].found.length);
  check('calculated', 'a formula is read with letters, numbers and brackets, and a bad one is refused', DY.compile('(A − B) ÷ A × 100', 2).fn([10, 4]) === 60 && DY.compile('A + 2 * (B - 1)', 2).fn([1, 3]) === 5 && !!DY.compile('A + C', 2).error && !!DY.compile('A +', 1).error && !!DY.compile('alert(1)', 1).error);
  const d1 = DY.saveDef('@plant', { name: 'Pressure gap', unit: 'bar', inputs: [{ reading: 'Line pressure', label: 'Upstream' }, { reading: 'Line pressure', label: 'Downstream' }], expr: 'A − B' });
  check('calculated', 'the library defines one against kinds of reading, at any level; an equipment type only on its own readings', d1.ok && !DY.saveDef('@plant', { name: 'x', inputs: [{ reading: 'Level' }, { reading: 'pH' }], expr: 'A' }).ok && !DY.saveDef('BLW', { name: 'x', inputs: [{ reading: 'Dissolved oxygen' }], expr: 'A' }).ok && DY.saveDef('BLW', { name: 'Half load', unit: 'A', inputs: [{ reading: 'Motor current' }], expr: 'A / 2' }).ok);
  const o1 = DY.offers('manesar').find((o) => o.def.id === d1.def.id);
  check('calculated', 'the plant is offered it and must choose the exact sensor for each letter', !!o1 && o1.choose && o1.value === null && !DY.use('manesar', o1.pid, 'on').ok && o1.inputs.every((q) => q.found.length >= 2));
  DY.pick('manesar', o1.pid, 0, o1.inputs[0].found[0].id); DY.pick('manesar', o1.pid, 1, o1.inputs[1].found[1].id); const o2 = DY.offer('manesar', o1.pid);
  check('calculated', 'once chosen it is worked out on the latest readings, and using it is optional', !o2.choose && o2.value === Math.round((o1.inputs[0].found[0].v - o1.inputs[1].found[1].v) * 100) / 100 && DY.use('manesar', o1.pid, 'on').ok && DY.offer('manesar', o1.pid).state === 'on' && !DY.removeDef('@plant', d1.def.id).ok && DY.use('manesar', o1.pid, 'off').ok && DY.removeDef('@plant', d1.def.id).ok);
  const bl = DY.offers('manesar').filter((o) => o.def.name === 'Half load');
  check('calculated', 'an equipment type\'s value is offered per piece of equipment; one with a single sensor needs no choosing', bl.length === 2 && bl.some((o) => !o.choose && !o.missing.length && o.value != null));
  V.reset(); check('calculated', 'a reset puts it back', UA.alerts('@group').length === 0 && UA.alerts('@plant').length === 0 && !DY.defs('@plant').some((d) => d.name === 'Pressure gap') && UA.offers('manesar').every((o) => !o.sk)); }

/* a calculated value inside an alert's condition */
V.reset(); { const UA = g.V7UPALERT; const DY = g.V7DYN;
  const d = DY.saveDef('@plant', { name: 'Pressure gap', unit: 'bar', inputs: [{ reading: 'Line pressure', label: 'Upstream' }, { reading: 'Line pressure', label: 'Downstream' }], expr: 'A − B' });
  const a = UA.saveAlert('@plant', { name: 'Pressure gap too wide', match: 'all', when: [{ calc: d.def.id, dir: 'above', limit: 0.2 }, { reading: 'Motor current', dir: 'above', limit: 1 }], band: 'major', hold: 5, starts: { kind: 'issue' } });
  check('calc in alert', 'an alert watches a calculated value of its own type, beside a reading', a.ok && a.alert.when[0].calc === d.def.id && UA.alerts('@plant')[0].when[0].reading === 'Pressure gap' && /Pressure gap is above 0.2 bar and Motor current is above 1 A/.test(UA.sentence(UA.alerts('@plant')[0], null)));
  check('calc in alert', 'one from another type, or with no limit, is refused', !UA.saveAlert('@group', { name: 'x', when: [{ calc: d.def.id, dir: 'above', limit: 1 }] }).ok && !UA.saveAlert('@plant', { name: 'y', when: [{ calc: d.def.id, dir: 'above', limit: '' }] }).ok);
  const o = UA.offers('manesar').find((x) => x.sk === 'plant'); const dp = o.conds[0].dyn;
  check('calc in alert', 'at the plant it waits until the sensors behind the value are chosen', o.conds[0].calc === d.def.id && o.choose && !UA.decide('manesar', o.pid, 'applied').ok && !o.now.fires);
  DY.pick('manesar', dp.pid, 0, dp.inputs[0].found[0].id); DY.pick('manesar', dp.pid, 1, dp.inputs[1].found[1].id); const o2 = UA.offer('manesar', o.pid); const gap = Math.round((dp.inputs[0].found[0].v - dp.inputs[1].found[1].v) * 100) / 100;
  check('calc in alert', 'then it is worked out on the latest readings and the alert fires on it', !o2.choose && o2.conds[0].found[0].v === gap && o2.now.parts[0].ok === (gap > 0.2) && UA.decide('manesar', o.pid, 'applied').ok);
  check('calc in alert', 'the plant can change the limit on it; the library value cannot be removed while an alert watches it', UA.edit('manesar', o.pid, { match: 'all', band: 'major', hold: 5, when: [{ calc: d.def.id, dir: 'above', limit: 5 }] }).ok && UA.offer('manesar', o.pid).conds[0].limit === 5 && UA.offer('manesar', o.pid).now.fires === (gap > 5) && !DY.removeDef('@plant', d.def.id).ok);
  check('calc in alert', 'renaming the value renames it on the alert', DY.saveDef('@plant', { ...d.def, name: 'Header gap' }).ok && UA.alerts('@plant')[0].when[0].reading === 'Header gap');
  const h = DY.saveDef('BLW', { name: 'Half load', unit: 'A', inputs: [{ reading: 'Motor current' }], expr: 'A / 2' }); const ha = UA.saveAlert('BLW', { name: 'Half load high', when: [{ calc: h.def.id, dir: 'above', limit: 10 }], band: 'minor', hold: 5, starts: { kind: 'issue' } }); const ho = UA.offers('manesar').find((x) => x.upTag === 'BL-1' && x.name === 'Half load high'); const ho2 = UA.offers('manesar').find((x) => x.upTag === 'BL-2' && x.name === 'Half load high');
  check('calc in alert', 'an equipment type does the same on its own readings; equipment without the sensor is skipped', h.ok && ha.ok && !!ho && !ho.skipped && !ho.choose && ho.now.fires === (ho.conds[0].found[0].v > 10) && ho2.skipped);
  V.reset(); }

/* severity timelines, and calibration on a reading */
V.reset(); { const SV = g.V7SEV; const CAL = g.V7CAL; const C = g.CTL;
  check('severity', 'each severity has a timeline: time to start, time to fix, and a repeat', SV.lib('major').start === 8 && SV.lib('major').fix === 24 && SV.lib('major').repeat > 0 && SV.lib('emergency').start === 1 && /every/.test(SV.sentence('minor', SV.lib('minor'))));
  check('severity', 'the library changes it, and a bad one is refused', SV.setLib('major', { start: 4, fix: 12, repeat: 6 }).ok && SV.lib('major').fix === 12 && !SV.setLib('major', { start: 10, fix: 5, repeat: 1 }).ok && !SV.setLib('caution', { start: 1, fix: 2, repeat: 1 }).ok && !SV.setLib('major', { start: 0, fix: 5, repeat: 1 }).ok);
  check('severity', 'a plant follows the library until it keeps its own', SV.plant('manesar', 'major').fix === 12 && !SV.plant('manesar', 'major').own && SV.setPlant('manesar', 'major', { start: 2, fix: 6, repeat: 2 }).ok && SV.plant('manesar', 'major').own && SV.plant('manesar', 'major').fix === 6 && SV.plant('digitalpaani', 'major').fix === 12);
  check('severity', 'the words everywhere follow it', /4 h/.test(V.sevClock('major')) && /12 h/.test(V.sevClock('major')) && C.SEV_CLOCK.major[0] === 4 && C.SEV_CLOCK.caution[0] == null);
  const is = V.issues('manesar', {}).find((i) => !i.closed && i.status !== 'closed' && SV.BANDS.includes(i.band)); const st = is ? SV.steps('manesar', is) : [];
  check('severity', 'an open issue lists its steps with their times', !!is && st.length === 3 && st[1].at === is.opened + SV.plant('manesar', is.band).fix * 3600000 && st[2].at > st[1].at && (is.status === 'open' || st[0].state === 'skip'));
  check('severity', 'back to the library, and a reset puts it back', SV.setPlant('manesar', 'major', null).ok && !SV.plant('manesar', 'major').own && (V.reset(), SV.lib('major').fix === 24));
  const dl = CAL.lib('OS_TANK_DF', 'Dissolved oxygen'); const bp = V.libType('BLW').readings.find((r) => r.kind === 'process');
  check('calibration', 'a probe is calibrated every month with its flow unless the library says otherwise; other readings have none', !!dl && dl.n === 1 && dl.unit === 'month' && dl.flowId === 'f_do_cal' && !dl.set && !!bp && CAL.lib('BLW', bp.name) === null && CAL.lib('BLW', 'Run status') === null);
  const sc0 = C.S.plants.manesar.d.schedules.find((x) => x.workType === 'calibration' && x.probe === 'at2_do');
  check('calibration', 'the library sets how often and which flow, and the task at a plant takes it', !!sc0 && CAL.setLib('OS_TANK_DF', 'Dissolved oxygen', { n: 2, unit: 'week', flowId: 'f_probe_cal' }).ok && sc0.every.n === 2 && sc0.every.unit === 'week' && sc0.flow === 'f_probe_cal' && CAL.plant('manesar', 'at2_do').n === 2 && !CAL.plant('manesar', 'at2_do').own);
  check('calibration', 'a bad interval or a flow that is not a calibration is refused', !CAL.setLib('OS_TANK_DF', 'Dissolved oxygen', { n: 0, unit: 'week' }).ok && !CAL.setLib('OS_TANK_DF', 'Dissolved oxygen', { n: 1, unit: 'hour' }).ok && !CAL.setLib('OS_TANK_DF', 'Dissolved oxygen', { n: 1, unit: 'month', flowId: 'd_mb_blower' }).ok && !CAL.setLib('BLW', 'Run status', { n: 1, unit: 'month' }).ok);
  check('calibration', 'a plant keeps its own for one sensor, and goes back', CAL.setPlant('manesar', 'at2_do', { n: 3, unit: 'month', flowId: 'f_do_cal' }).ok && CAL.plant('manesar', 'at2_do').own && sc0.every.n === 3 && sc0.flow === 'f_do_cal' && CAL.setPlant('manesar', 'at2_do', null).ok && !CAL.plant('manesar', 'at2_do').own && sc0.every.n === 2);
  const before = V.libraryReview('manesar').reduce((n, r) => n + r.proposals.filter((p) => / calibration$/.test(p.name)).length, 0);
  const okP = CAL.setLib('BLW', bp.name, { n: 6, unit: 'month', flowId: 'f_probe_cal' }).ok; const after = V.libraryReview('manesar').reduce((n, r) => n + r.proposals.filter((p) => / calibration$/.test(p.name)).length, 0);
  check('calibration', 'calibration added to a reading that had none is offered to plants as a task', okP && CAL.lib('BLW', bp.name).n === 6 && after > before && V.libraryReview('manesar').some((r) => r.proposals.some((p) => p.name === bp.name + ' calibration')));
  check('calibration', 'switching it off takes the offer away again, and a reset puts everything back', CAL.setLib('BLW', bp.name, null).ok && CAL.lib('BLW', bp.name) === null && V.libraryReview('manesar').reduce((n, r) => n + r.proposals.filter((p) => / calibration$/.test(p.name)).length, 0) === before && (V.reset(), CAL.lib('OS_TANK_DF', 'Dissolved oxygen').n === 1)); }

/* one worked-out criticality per piece of equipment */
V.reset(); { const CR = g.V7CRIT; const k = 'manesar'; const st = V.structure(k); const grp = st.cgs.find((c) => c.memberIds.length > 1); const b1 = grp.memberIds[0]; const u = st.ups.find((x) => x.members.some((m) => m.eqId === b1));
  const d0 = CR.derived(k, b1); const T = CR.TIERS; const down = (t, n) => T[Math.min(2, T.indexOf(t) + n)];
  check('worked out', 'a standby is never assumed: equipment in a set carries the criticality of its unit process until someone confirms one, and every screen reads that one value', !!u && d0.from === 'worked' && d0.role === 'stops' && !CR.role(k, b1).own && d0.tier === CR.upTier(k, u.id).tier && V.equipment(k).find((e) => e.id === b1).tier === d0.tier && V.eq(k, b1).tier === d0.tier && V.eq(k, b1).typeTier === d0.typeTier);
  check('worked out', 'the step itself carries its unit process\'s criticality', st.ups.filter((x) => V.equipment(k).some((e) => e.id === x.id)).every((x) => CR.derived(k, x.id).tier === CR.upTier(k, x.id).tier));
  check('worked out', 'the role changes it: a confirmed standby is one lower, and so is degraded', CR.setRole(k, b1, 'standby').ok && CR.role(k, b1).own && CR.derived(k, b1).tier === down(CR.upTier(k, u.id).tier, 1) && CR.setRole(k, b1, 'degraded').ok && CR.derived(k, b1).tier === down(CR.upTier(k, u.id).tier, 1) && CR.role(k, b1).own && !CR.setRole(k, b1, 'never').ok);
  check('worked out', 'the unit process changes every piece of equipment in it', CR.setUpTier(k, u.id, 'A').ok && CR.derived(k, b1).tier === 'B' && CR.derived(k, u.id).tier === 'A' && CR.setUpTier(k, u.id, null).ok && CR.setRole(k, b1, null).ok && CR.derived(k, b1).tier === d0.tier && !CR.role(k, b1).own);
  const lone = V.equipment(k).find((e) => !CR.upsOfEq(k, e.id).length);
  check('worked out', 'equipment in no unit process keeps its type\'s criticality', !lone || (CR.derived(k, lone.id).from === 'type' && lone.tier === lone.typeTier));
  check('worked out', 'the timeline card counts equipment by the worked-out value, and a reset puts it back', V.equipment(k).every((e) => T.includes(e.tier)) && (V.reset(), CR.derived(k, b1).tier === d0.tier)); }

const bad = results.filter((x) => !x).length;
console.log(`v77.test · ${results.length - bad}/${results.length} checks pass · RESULT: ${bad ? 'FAIL' : 'PASS'}`);
process.exit(bad ? 1 : 0);
