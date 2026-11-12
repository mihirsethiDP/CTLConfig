/* v7/3 · help73.js — the helper on every alert, task and library item at a plant: in plain words, what its settings do,
   who is told, and what those people must then do. It is worked out from the same settings the engine reads (the ranges and their
   timing, what each range triggers, the plant's people and how each is reached, the flows), so it changes as they change.
   window.V7HELP73 = { alert(key, alertId, {open}) · task(key, taskId, {open}) · proposal(key, p) } → html ('' when there is nothing). */
(function () {
  'use strict';
  const W = window; const UI = W.V7UI; if (!UI) return;
  const V = () => W.V7; const { esc, plural } = UI;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, fb) => { try { const v = fn(); return v == null ? fb : v; } catch (e) { return fb; } };
  const BANDS = ['caution', 'minor', 'major', 'emergency']; const NAME = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const sev = (b) => (UI.sev ? UI.sev(b) : esc(NAME[b]));
  const enc = encodeURIComponent;
  const ROLE = { l1: 'Operators', l3: 'Leads', l4: 'Senior Leads' };

  /* the plant's people of a role, by name, and how one is reached */
  function who(key, role, how) {
    if (key == null) return `<b>${esc(ROLE[role])}</b> ${how === 'channel' ? 'by WhatsApp or SMS, or in the app if they have no verified phone' : esc(how)}`;   /* a library type: the roles, at whichever plant has it */
    const ps = arr(safe(() => V().people(key), [])).filter((p) => p.role === role);
    if (!ps.length) return `<span class="hp-none">no ${esc(ROLE[role].replace(/s$/, ''))} at this plant yet (add one in the User Center)</span>`;
    const names = ps.length <= 3 ? ps.map((p) => p.name).join(', ') : `${ps.slice(0, 2).map((p) => p.name).join(', ')} and ${ps.length - 2} more`;
    const by = how === 'channel' ? [...new Set(ps.map((p) => (p.reachable ? p.channel : 'in the app')))].join(' or ') : how;
    return `<b>${esc(ROLE[role])}</b> (${esc(names)}) ${how === 'channel' ? (by === 'in the app' ? 'in the app' : 'by ' + esc(by)) : esc(by)}`;
  }
  /* who an issue at this severity reaches on a Live plant (the engine's own rule) */
  function toldFor(key, b) {
    if (b === 'emergency') return [who(key, 'l1', 'by phone call'), who(key, 'l3', 'by phone call'), who(key, 'l4', 'by phone call'), 'a full-screen alarm for each, and the plant hooter'];
    if (b === 'major') return [who(key, 'l1', 'channel'), who(key, 'l3', 'channel'), 'a full-screen alarm for each'];
    if (b === 'minor') return [who(key, 'l1', 'channel'), who(key, 'l3', 'in the app')];
    return [who(key, 'l1', 'in the app and the morning email'), who(key, 'l3', 'in the app and the morning email')];
  }
  const clock = (b) => { const t = String(safe(() => V().sevClock(b), '')); return b === 'caution' ? 'No deadline: it is seen in the app and the morning email.' : t ? `${t}.` : ''; };
  const list = (xs) => `<ul class="hp-ul">${xs.filter(Boolean).map((x) => `<li>${x}</li>`).join('')}</ul>`;
  const flowById = (id) => (id ? safe(() => V().flowOf(id), null) : null);
  function stepsLine(f, noun) {
    const st = arr(f && f.steps); if (!st.length) return '';
    const photos = st.filter((s) => s.photo === 'required').length; const reads = st.filter((s) => s.type === 'reading').length;
    const first = st.slice(0, 3).map((s) => esc(String(s.text || '').replace(/[.?]\s*$/, ''))).join('; ');
    return `${plural(st.length, noun)}: ${first}${st.length > 3 ? `; and ${st.length - 3} more` : ''}.${photos ? ` ${plural(photos, 'photo')} required.` : ''}${reads ? ` ${plural(reads, 'reading')} to record.` : ''}`;
  }
  function diagLine(flowId) {
    const f = flowById(flowId);
    if (!f) return 'Say what they found: this alert has no diagnostic flow yet.';
    const causes = [...new Set(arr(f.steps).flatMap((s) => Object.values(s.answers || {}).filter((a) => a && a.t === 'cause').map((a) => a.id)))];
    return `Answer the <a href="#/flows/${esc(enc(f.id))}">${esc(f.name)}</a> questions (${arr(f.steps).length}) until they land on one of ${plural(causes.length, 'root cause')}, do that root cause's fix steps, check the reading is back inside its limits, and close the issue.`;
  }
  const wrap = (title, inner, open, cls) => `<details class="hp${cls ? ' ' + cls : ''}"${open ? ' open' : ''}><summary><span class="hp-q" aria-hidden="true">?</span>${esc(title)}</summary><div class="hp-b">${inner}</div></details>`;
  const part = (k, html) => `<div class="hp-p"><h4>${esc(k)}</h4>${html}</div>`;

  /* ── an alert ──────────────────────────────────────────────────────────────────────────────────────── */
  function alertBody(key, al) {
    const P = safe(() => V().plant(key), {}); const live = P.state === 'live';
    const fv = (v) => safe(() => V().fmtVal(v, al.unit, al.kind), String(v));
    const set = BANDS.filter((b) => al.bands && al.bands[b] != null);
    const tasks = {}; arr(safe(() => V().lineWork(key, { sensorId: al.sensorId, dir: al.dir }), [])).forEach((w) => { tasks[w.band] = w; });
    const hold = al.hold && al.hold.value != null ? al.hold.value : null; const clear = al.clear && al.clear.value != null ? al.clear.value : null;
    const whenOf = (b) => (al.kind === 'status' ? `reads ${fv(al.bands[b])}` : `${al.dir === 'below' ? 'falls below' : 'rises above'} ${fv(al.bands[b])}`) + (b === 'emergency' || hold === 0 ? ', on the first reading' : hold != null ? ` and stays there for ${hold} min` : '');
    const what = !set.length ? '<p class="hp-none">It has no limits yet, so it does nothing.</p>'
      : `<p>It watches <b>${esc(al.sensorName || 'a reading')}</b>${al.eqTag ? ` on <b>${esc(al.eqTag)}</b>` : ''}.</p>` + list(set.map((b) => { const t = tasks[b]; return `${sev(b)} when it ${esc(whenOf(b))}: ${t ? `raises the task <a href="#/p/${esc(enc(key))}/task/${esc(enc(t.id))}">${esc(t.name)}</a> on ${esc(t.eqTag || 'this equipment')}, and opens no issue` : 'opens an issue'}.`; }))
        + (clear != null ? `<p class="hp-s">An issue nobody has started closes by itself once the reading has been back inside its limits for ${clear} min. Emergency never closes by itself.</p>` : '');
    let told; let must;
    if (al.state === 'draft' || al.state === 'off') { told = `<p>Nobody: this alert is ${al.state === 'draft' ? 'a draft' : 'Off'}, so it does not watch its reading.</p>`; must = '<p>Nothing, until someone turns it on.</p>'; }
    else if (!live || al.state === 'trial') {
      told = `<p><b>Nobody yet.</b> ${!live ? 'The plant is in Commissioning' : 'This alert is On trial'}: each crossing is kept as a trial firing and nothing is sent, Emergency included.</p><p class="hp-s">${!live ? 'Once the plant is Live' : 'Once it is On'}:</p>` + list(set.filter((b) => !tasks[b]).map((b) => `${sev(b)} ${toldFor(key, b).join('; ')}.`));
      must = `<p><b>Nothing yet.</b> ${!live ? 'Once the plant is Live' : 'Once it is On'}:</p>` + list(set.map((b) => (tasks[b] ? `${sev(b)} do the task ${esc(tasks[b].name)}.` : `${sev(b)} ${esc(clock(b))}`)).concat(set.some((b) => !tasks[b]) ? [diagLine(al.flowId)] : []));
    } else {
      told = list(set.map((b) => (tasks[b] ? `${sev(b)} ${who(key, 'l1', 'in the app')}, as a task that is due.` : `${sev(b)} ${toldFor(key, b).join('; ')}.`)));
      must = list(set.map((b) => (tasks[b] ? `${sev(b)} do the task ${esc(tasks[b].name)} and mark it done.` : `${sev(b)} ${esc(clock(b))}`)).concat(set.some((b) => !tasks[b]) ? [diagLine(al.flowId)] : []));
    }
    return part('What these settings do', what) + part('Who is told', told) + part('What they must do', must);
  }
  function alert(key, alertId, o) { const al = safe(() => V().alert(key, alertId), null); if (!al) return ''; return wrap('What this alert does, who is told, and what they must do', alertBody(key, al), !!(o && o.open), o && o.cls); }

  /* ── a task ────────────────────────────────────────────────────────────────────────────────────────── */
  function taskBody(key, t) {
    const P = safe(() => V().plant(key), {}); const live = P.state === 'live';
    const where = t.kind === 'group' && arr(t.tags).length > 1 ? `${arr(t.tags).length} pieces of equipment (${esc(arr(t.tags).slice(0, 6).join(', '))}${arr(t.tags).length > 6 ? '…' : ''}), as one task with a line for each` : arr(t.tags).length ? esc(t.tags[0]) : 'the plant as a whole';
    const lateH = t.kind === 'line' ? 24 : Math.max(2, (t.intervalH || 0) * 0.2); const lateText = lateH >= 48 ? `${Math.round(lateH / 24)} days` : `${Math.round(lateH)} hours`;
    const what = t.kind === 'line'
      ? `<p>It is raised on <b>${where}</b> ${esc(String((t.from || {}).whenText || '').replace(/^When/, 'when'))}. That range opens no issue; the next range out does. Once someone marks it done it waits for the reading to cross again.</p>`
      : `<p>It comes due on <b>${where}</b> ${esc(t.everyText || '')}${t.basis === 'meter' || t.basis === 'either' ? ', counted by the hour meter while the equipment runs' : ''}. The next one is counted ${t.anchor === 'last' ? 'from the day it is done' : 'from its due date, so doing it late does not move the ones after it'}.</p>`;
    const told = live
      ? `<p>${who(key, 'l1', 'in the app')}, when it is due.</p><p class="hp-s">If nobody marks it done within ${esc(lateText)} it shows as Overdue on the plant's Tasks tab, where the Leads see it.</p>`
      : `<p><b>Nobody yet.</b> Tasks start when the plant goes live. Then: ${who(key, 'l1', 'in the app')}, when it is due.</p>`;
    const f = flowById(t.flowId); const steps = f ? stepsLine(f, 'step') : arr(t.steps).length ? stepsLine({ steps: t.steps }, 'step') : '';
    const must = `<p>${steps ? `Do its ${steps} Tick each one, then mark the task done.` : 'Do the work and mark the task done. It has no written steps yet.'}${f ? ` <a href="#/flows/${esc(enc(f.id))}">Open or edit the steps</a>` : ''}</p>`;
    return part('What these settings do', what) + part('Who is told', told) + part('What they must do', must);
  }
  function task(key, taskId, o) { const t = safe(() => V().task(key, taskId), null); if (!t) return ''; return wrap('What this task does, who is told, and what they must do', taskBody(key, t), !!(o && o.open), o && o.cls); }

  /* ── a library item proposed for this plant (the Library tab) ──────────────────────────────────────── */
  function proposal(key, p) {
    if (!p) return ''; const P = safe(() => V().plant(key), {}); const live = P.state === 'live'; const on = p.eqId === 'plant' ? 'the plant' : p.tag;
    if (p.blockedBy) {
      const why = p.nextPhase ? 'It reads a connection between two pieces of equipment, which arrives in the next phase.' : `${esc(p.blockedBy)}.`;
      return wrap('What this would do, and why it can\'t be used yet', part('Why it is not inherited', `<p>${why}</p>`) + part('What that means', `<p>Nothing watches this on ${esc(on)}, and nobody is told. ${p.nextPhase ? '' : 'Add the sensor in the Visualization, read the Visualization again, and it can be accepted here.'}</p>`));
    }
    const acc = p.decided === 'accepted'; const rej = p.decided === 'rejected'; const lead = rej ? `<p><b>Left out at this plant</b>${p.reason ? `: “${esc(p.reason)}”` : ''}. If it were accepted:</p>` : acc ? '' : '<p>If you accept it:</p>';
    if (p.kind === 'alert') {
      const bands = BANDS.filter((b) => new RegExp(NAME[b]).test(p.detail || ''));
      const what = `${lead}<p>It watches <b>${esc(p.reading || p.name)}</b> on <b>${esc(on)}</b> and opens an issue: ${esc(p.detail || '')}. ${live ? 'It runs On trial for 7 days first: crossings are kept as trial firings and nothing is sent.' : 'While the plant is in Commissioning it runs On trial: crossings are kept as trial firings and nothing is sent.'}</p>`;
      const told = `<p class="hp-s">Once it is On${live ? '' : ' and the plant is Live'}:</p>` + list(bands.map((b) => `${sev(b)} ${toldFor(key, b).join('; ')}.`));
      const must = list(bands.map((b) => `${sev(b)} ${esc(clock(b))}`).concat(['Answer its diagnostic questions to find the root cause, do the fix steps, check the reading, and close the issue.']));
      return wrap('What this would do, who would be told, and what they would do', part('What these settings do', what) + part('Who is told', told) + part('What they must do', must));
    }
    const what = `${lead}<p>The task comes due on <b>${esc(on)}</b>: ${esc(p.detail || '')}. ${live ? 'It starts now.' : 'It starts when the plant goes live, with first due dates spread out.'}</p>`;
    const told = `<p>${who(key, 'l1', 'in the app')}, when it is due. If it runs late it shows as Overdue on the plant's Tasks tab.</p>`;
    const must = '<p>Do its steps, tick each one, and mark the task done.</p>';
    return wrap('What this would do, who would be told, and what they would do', part('What these settings do', what) + part('Who is told', told) + part('What they must do', must));
  }

  /* ── a library type's alert and task (no plant: roles, not names) ──────────────────────────────────── */
  function typeAlert(lt, x, r, d) {
    const fv = (v) => safe(() => V().fmtVal(v, r.unit, r.kind), String(v)); const bands = (d && d.bands) || {}; const set = BANDS.filter((b) => bands[b] != null);
    const whenOf = (b) => (r.kind === 'status' ? `reads ${fv(bands[b])}` : `${d.dir === 'below' ? 'falls below' : 'rises above'} ${fv(bands[b])}`) + (b === 'emergency' || +x.hold === 0 ? ', on the first reading' : x.hold != null ? ` and stays there for ${x.hold} min` : '');
    const what = `<p>At every plant that has a <b>${esc(lt.typeName)}</b> with a <b>${esc(r.name)}</b> reading, and has accepted it:</p>` + (set.length ? list(set.map((b) => `${sev(b)} when it ${esc(whenOf(b))}: opens an issue.`)) : '<p class="hp-none">It has no limits in the library, so it does nothing until a plant sets them.</p>')
      + '<p class="hp-s">A plant that changed a limit keeps its own. A plant can also make a range trigger a task instead.</p>';
    const told = '<p class="hp-s">On a Live plant. On a new plant nothing is sent.</p>' + list(set.map((b) => `${sev(b)} ${toldFor(null, b).join('; ')}.`));
    const must = list(set.map((b) => `${sev(b)} ${esc(clock(b))}`).concat([diagLine(x.flowId)]));
    return wrap('What this alert does at a plant, who is told, and what they must do', part('What these settings do', what) + part('Who is told', told) + part('What they must do', must));
  }
  function typeTask(lt, x) {
    const shared = ['routine', 'work', 'test'].includes(x.workType);
    const what = `<p>At every plant that has a <b>${esc(lt.typeName)}</b> and has accepted it, the task comes due ${esc(x.everyText || '')}. ${shared ? 'It is one task for the type at the plant, with a line for each piece of equipment.' : 'Each piece of equipment gets its own.'} It starts when the plant goes live.</p>`;
    const told = `<p>${who(null, 'l1', 'in the app')}, when it is due. If it runs late it shows as Overdue on the plant's Tasks tab.</p>`;
    return wrap('What this task does at a plant, who is told, and what they must do', part('What these settings do', what) + part('Who is told', told) + part('What they must do', '<p>Do its steps, tick each one, and mark the task done.</p>'));
  }
  /* ── a flow ────────────────────────────────────────────────────────────────────────────────────────── */
  function flow(f, used) {
    if (!f) return ''; const st = arr(f.steps); const lines = arr(used && used.lines);
    const usedHtml = lines.length ? list(lines.slice(0, 4).map((x) => esc(x)).concat(lines.length > 4 ? [`and ${lines.length - 4} more`] : [])) : '<p class="hp-none">Nothing starts it yet, so nobody sees it.</p>';
    if (f.kind === 'diagnostic') {
      const ids = [...new Set(st.flatMap((s) => Object.values(s.answers || {}).filter((a) => a && a.t === 'cause').map((a) => a.id)))];
      const what = `<p>It finds the root cause of an issue by asking up to <b>${plural(st.length, 'question')}</b>, one at a time. Each answer leads to the next question or lands on one of <b>${plural(ids.length, 'root cause')}</b>, and a root cause names the fix flow that puts it right.</p>`;
      const told = '<p>Nobody is told by the flow itself. It opens for whoever starts the issue, an Operator or a Lead, on these:</p>' + usedHtml;
      const must = '<p>Check each thing on site and answer. When it lands on a root cause, do that fix flow, check the reading is back inside its limits, and close the issue. If no answer fits, say what was found.</p>';
      return wrap('What this flow does, who uses it, and what they must do', part('What it does', what) + part('Who uses it', told) + part('What they must do', must), true, 'hp-card');
    }
    const fix = f.use === 'fix';
    const what = `<p>It is the steps of ${fix ? 'a fix' : 'a task'}: ${stepsLine(f, 'step') || 'no steps yet.'}</p>`;
    const told = (fix ? '<p>Whoever is fixing the issue, an Operator or a Lead, once the diagnostic flow lands on:</p>' : `<p>${who(null, 'l1', 'in the app')}, when the task is due:</p>`) + usedHtml;
    const must = '<p>Do each step in order and tick it. Take the photo where one is required, and record the reading where one is asked for. Then mark it done.</p>';
    return wrap('What this flow does, who uses it, and what they must do', part('What it does', what) + part('Who uses it', told) + part('What they must do', must), true, 'hp-card');
  }

  W.V7HELP73 = { alert, task, proposal, typeAlert, typeTask, flow };
}());
