/* v7/7 · tests/v77.test.js — what v7/7 adds, checked on the core with no browser:
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
for (const f of ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'structure73.js', 'nodes73.js', 'core7.js', 'calls73.js', 'decisions7.js', 'shadow77.js', 'lang77.js']) vm.runInThisContext(fs.readFileSync(path.join(A, f), 'utf8'), { filename: f });
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

const bad = results.filter((x) => !x).length;
console.log(`v77.test · ${results.length - bad}/${results.length} checks pass · RESULT: ${bad ? 'FAIL' : 'PASS'}`);
process.exit(bad ? 1 : 0);
