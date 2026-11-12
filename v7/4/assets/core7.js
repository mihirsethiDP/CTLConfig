/* core7.js — window.V7: the heart of the v7 study (CloseTheLoop configuration, end to end).
   Loads after v6's layer (data.js … app.js, runtime.js = window.CTL, window.CTL_RT). Never touches the DOM; runs headless in node.
   Owns all v7 state in V7.S and saves it next to CTL's estate (localStorage 'ctl74.overlay.v1' + 'ctl74.estate.v1'). If either save is
   missing or does not match this build, both are seeded again (the story's start). One clock for every plant; ids from a seeded counter.

   ─── API (every key is a plant key: 'digitalpaani' | 'vedanta' | 'manesar' | 'bawal'; every time is epoch ms) ───────────────────
   Life:      boot() restore or seed · reset() reseed the story · persist() save both stores now · S (getter: the v7 state, read-only)
   Clock:     now() · fmt(ms) "Thu 29 Oct, 09:00" (IST) · fmtDay(ms) "Thu 29 Oct" · fmtDate(ms) "29 Oct 2026" · fmtTime(ms) "09:00"
              fmtDur(min) "45 min" · advance(minutes) → {from,to,opened:[{id,plant,title,band,opened}],closed:[…],trial:[{plant,alertId,
              name,start,band}],tasksDue:[{plant,id,name,due}],expired:[overrideIds],trialEnded:[alertIds],summary} (runs the engine for every
              plant from the old now to the new now, split at each moment inside where a "For now" change ends or a Live plant's 7-day
              trial ends, so the engine uses the right terms on each side)
   Plants:    plants() → [{key,name,type,state,stateLabel,since,sample,realLayout}] · plant(key) (same + counts) · state(key)
              'commissioning'|'live' · withPlant(key,fn) (CTL.withPlant) · equipment(key) · eq(key,id) · sensors(key,eqId?) (incl. next phase)
              readings(key,{eqId}) the Visualization readings + manual/lab ones (from the plant's manual tests) · alerts(key,{eqId,sensorId,state})
              alert(key,id) · schedules(key,{eqId}) · people(key) → roster [{id,name,role,roleLabel,phone,channel,reachable}]
   Series:    series(key,sensorId,from,to,stepMin=15) → [{t,v}] (pure, deterministic; polls at :10/:25/:40/:55) · latest(key,sensorId) {t,v}
              replay(key,alertId,{from,to,limits?,hold?,clear?}) → {firings:[{start,end,band,firstBand,peak,limit,short,steps}],count,perDay,
              shortShare,days,from,to} (pure) · previewLimits(key,sensorId,dir,bands,{days=7}) → {count,countNow,days,alertId}
              trialStats(key,alertId) → replay over the trial so far + {since,trialDays,noisy,mostlyShort} | null · isNoisy(key,alertId)
   Alerts:    alertState(key,id) 'draft'|'trial'|'on'|'off' · setAlertState(key,id,state,{note}) → {ok,error?}
   Limits:    limitsOf(key,sensorId,dir?) → {dir,unit,nextPhase,bands,perBand:{band:{value,chip,chipText,libValue,baseValue,base,overrideId}}}
              dirs(key,sensorId) · libLimits(typeName,readingName,dir,{draft}) · sourceOf(key,target) (target as in the ledger) →
              {value,chip,chipText,libValue,base,overrideId,baseFrom?} ('notinlib' chip: a task neither the library nor the Visualization has) · setLimits(key,sensorId,dir,bands,{reason,note,until}) → {ok,error?,changed,overrides}
              setAlertTiming(key,alertId,{hold,clear},{reason,note,until}) · setCadence(key,scheduleId|taskId,{n,unit},{reason,note,until})
              setTier(key,eqId,tier,{reason,note}). Chips: 'lib' From the library · 'form' From the Visualization · 'changed' Changed here ·
              'libchanged' Library changed since · 'none' No limits yet · 'next' Next phase. Precedence per band: change here → Visualization → library.
   Ledger:    overrides({plant,state}) (state: undefined = all not ended, 'all', 'ok'|'same'|'libchanged'|'review'|'ended') → records
              {id,plant,target,value,base,reason,note,until,reviewBy,author,at,endedAt,state,stateLabel,reasonLabel,what,plantValue,libValue,
              baseValue,baseFrom:'form'|'lib',baseWhy,baseLabel,backText,eqId,tag} · revert(id) (refuses a band that would break the order) ·
              revertPreview(id) → {ok,needsAll,error,bands:[{band,bandLabel,from,to}]} (checks that before the dialog; changes nothing) ·
              revertAll(id) (every changed band on that reading and direction) · keep(id,{until|reviewBy}) · suggest(id|{typeName,text})
              target kinds: {kind:'limit',sensorId,dir,band} {kind:'hold'|'clear',alertId} {kind:'onoff',alertId|scheduleId}
              {kind:'cadence',scheduleId} {kind:'tier',eqId}; and for what the library does not have (reason 'notinlib'):
              {kind:'reading',sensorId,dir} (the reading's own limits) · {kind:'alert',alertId} · {kind:'cadence',scheduleId}
   Reviews:   scadaReview(key) → {groups:[{typeName,code,count,accepted,acceptedAt,inDb,equipment:[…]}],notInDb,typeDiffers:[{eqId,tag,drawn,
              stored}],nextPhase:[…],elements} · acceptScadaGroup(key,typeName) · acceptAllScada(key) · libraryReview(key) → [{eqId,tag,
              typeName,proposals:[{pid,kind:'alert'|'task'|'condition',name,detail,decided,blockedBy?,sensorId?,dir?,every?}]}]
              decide(key,pid,'accept'|'reject',{reason}) · acceptAllFor(key,{typeName|eqId}) → {ok,count}
              acceptAllPreview(key,{typeName|eqId}?) → {live,count,alerts,newTasks,before:{perDay,perDayEach,tasks},after:{…}} (what
              Accept all would do, worked out on the real data and put back: nothing is saved)
   Checklist: checklist(key) → {state,tracks:{scada,library,people},blockers:[{id,text,link}],gaps:[{id,text,link,count,items}],canGoLive,
              whyNot} (the one function behind Readiness, Go live and Coverage)
   Go live:   goLivePreview(key) → {alertsOn,tasksPerDay,tasksPerDayIfEach,eachNoun,untried:[{alertId,name,minutes}] (On trial under a day),untriedText,firstDueSpread:true,changes:[strings]} · goLive(key)
              returnToCommissioning(key,reason)
   Records:   issues(key,{status:'open'|'closed',eqId}) (eqId also lists issues "caused by" it) · issue(key,id) · tasks(key,{status,eqId})
              task(key,id) (a task is a schedule, or a set-level group "Visual check · 6 pumps") · report(key,eqId,issueTypeId,{band})
              answer(key,issueId,stepId,answer) · chooseCause(key,issueId,causeId) · diagStep(key,issueId) · startFix · fixStep(key,id,stepId)
              verify(key,id,ok) · close(key,id,{falseAlarm,note}) · startTask(key,id) · doTaskStep(key,id,stepId) · doneTask(key,id)
              setLastDone(key,scheduleId|taskId,date)
   Flows:     flowOf(id) · diagFor(key,issue) · causeOf(id) · fixFlowFor(causeId,sensorName?) · linkedTask(stepRef) → {kind,id,name,flowId,
              steps,all} | null (stepRef: {flowId,stepId} or a step) · taskForGeneral(key,generalTaskId,eqId?) · issueTypes(typeName)
   Tasks:     taskGroups(key) · tasksPerDay(key,{each})
   Condition: lineWork(key,{sensorId,dir,eqId}) → [{id,name,why,sensorId,dir,band,bandLabel,limit,limitText,eqId,eqTag,reading,alertId,whenText}]
              setLineWork(key,sensorId,dir,band,{name,why}) (name null removes) · condition-based work is filed at the plant, never on equipment:
              a line on an equipment alert raises it (Live plant, alert On) instead of opening an issue; a task's kind 'line', status 'armed'
              while it waits for its reading; done puts it back to waiting
   Coverage:  coverage(key) → {state,since,days,alerts:[{alertId,name,firesPerDay,falseAlarmShare,medianCloseH,issues}],blindSpots,gaps,
              changes,totals}
   Library:   libTypes() (56) · libType(code) · libVersion(code) · libDraft(code) · editLib(code,{reading,dir,bands}|{schedule,every}|
              {alert,hold,clear}) · discardDraft(code) · whereItLands(code) → {plants:[{key,name,state,follows:[{what,from,to}],changedHere:
              [{what,plantValue,newLib}],fromForm,openIssues,dueNow:[{task,why}]}],totals,kind:'safety'|'normal',needsReason,text}
              publish(code,{note,reason}) → {ok,version,change} · suggestions(code?)
   Activity:  activity({plant,kind,limit}) → [{at,plant,who,text,kind}] newest first · log(plant,text,kind)
   Words:     LABELS, fmtVal(v,unit,kind), limitsText(bands,dir,unit), sevClock(band), bandLabel(band)
   v7 fixer:  trialStart(key) when the plant's trial started (earliest alert On trial) | null · noLimitsYet(key,reading) the one "No limits
              yet" test (gap, filter, chip) · eachOf(key) → {noun,types,phrase:'if each piece of equipment gets its own'} · revertAll(id) · a task view
              carries meter {now,at,left,rateDay} and runHours (source of its run-hours part); setCadence takes {runHours} too
   Extra:     issueTerms(key,issueId) → {text:'Opened under: Major below 1.0 mg/L, must hold for 0 min, …', changed, limitNow, changedText:
              'Opened under the old limit 1.0 mg/L (now 1.5 mg/L)'|null} · reportSensorFault(key,sensorId,{note}) → {ok,id,issue,calibrationTaskId}
              ("The sensor reads wrong": an issue already at its sensor-fault root cause; startFix runs the probe's calibration)
              causesFor(key,issueId) → the root causes its diagnostic and workbook issue can land on (for chooseCause) · manual/lab readings are addressed as 'm:<scheduleId>' and take
              limitsOf/setLimits like any reading (no samples) · fmtVal(2,'mg/L') "2.0 mg/L", fmtVal(6,'pH') "pH 6.0", fmtVal(1,'', 'status') "ON"

   ─── How the engine decides ─────────────────────────────────────────────────────────────────────────────
   Readings: value(plant, sensor, t) is a pure function (hash of plant:sensor and the 15-min slot) of a profile built from immutable
   inputs (the shipped library, the Visualization, data.js), never from limits, plus scripted moments that make the story happen. Polls fall at
   :10/:25/:40/:55 IST. A firing starts at the first poll where the reading has been past a band for "must hold for" (time since the
   first poll past it; Emergency starts on the first reading); a deeper band in the same excursion is a step up; it ends at the first
   poll where the reading has been back inside every band for "must clear for". Short = lasted ≤ 30 min, no step up, peak within 10 % of
   the limit it first crossed. replay() is that tracker from idle over [from,to]; trialStats() replays the trial so far with the alert's
   current limits and timing (so a reasoned change shows at once); advance() runs the same tracker statefully per plant. Live (alert On):
   a firing opens an issue with its terms; an issue escalates and clears by its own terms; an unstarted issue below Emergency closes by its
   reading, anything else waits for a person. On trial: firings are recorded only; one that reaches Emergency opens a real issue, tagged
   Commissioning on a Commissioning plant and told to the Leads by WhatsApp and in the app (no call, no hooter). Tasks on Live plants fall
   due on their interval; run-hours work falls due when its hour meter (which counts only while the equipment runs: duty about 20 h a
   day, standby about 1) reaches the reading at its last service, or at go live, plus its run-hours. At go live first due dates of
   calendar work are spread over each interval; a new interval counts from the last real completion, else from now.
   Seed: Manesar and Bawal ran the live engine over the last 30 days (people closed what it opened; short firings as false alarms);
   Vedanta ran its trial from Fri 23 Oct 10:55. Differences at Manesar come from comparing v6's in-place values with the computed base.
   Every mutating call saves (persist) and returns plain objects ({ok, error?} for actions); every read is safe to call while rendering
   (results are cached until the next change: treat them as read-only). */
window.V7 = (function () {
  'use strict';
  const C = window.CTL, RT = window.CTL_RT;
  if (!C) throw new Error('core7.js needs app.js (window.CTL) loaded first');

  /* ── constants ─────────────────────────────────────────────────────────────────────────────── */
  const OVERLAY = 'ctl74.overlay.v1', OVERLAY_V = 1, STORY = 'v74-story-1';   /* v7: story 5 = trial firings kept as records (card D24); story 4 = condition-based work is a task that a line on an equipment alert raises at the plant; story 2 = AT-2 DO back by 09:55, its diagnosis started at 07:50; story 3 = every seeded issue in Activity, an open issue's Lowest/Highest kept per poll, never-done work's new interval kept from the change date; an older saved story reseeds */
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR, POLL = 15 * MIN, IST = 330 * MIN;
  const T = (s) => Date.parse(s + ':00+05:30');                       // 'YYYY-MM-DDTHH:MM' in IST
  const NOW0 = T('2026-10-29T09:00');
  const GRID0 = T('2026-01-01T00:10');                                // polls at :10, :25, :40, :55
  const BANDS = ['caution', 'minor', 'major', 'emergency'];
  const RANK = { caution: 1, minor: 2, major: 3, emergency: 4 };
  const BAND_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const ORDER = ['digitalpaani', 'vedanta', 'manesar', 'bawal'];
  const ME = (C.PERSONA && C.PERSONA.global && C.PERSONA.global.who) || 'Satyadev Singh';
  const PLANT_META = {
    digitalpaani: { sample: false, realLayout: true, state: 'commissioning', since: T('2026-10-29T08:30') },
    vedanta: { sample: true, realLayout: false, state: 'commissioning', since: T('2026-10-23T10:00') },
    manesar: { sample: true, realLayout: false, state: 'live', since: T('2026-09-01T09:00') },
    bawal: { sample: true, realLayout: false, state: 'live', since: T('2026-07-15T09:00') },
  };
  /* v7: condition-based work is filed at the plant, never on equipment: a line on an equipment alert raises it. Manesar's two:
     BL-1's Caution line (a blocked intake filter makes the blower draw more current) and AT-1's MLSS line (time to waste sludge). */
  const LINE_WORK_SEED = {
    manesar: [
      { id: 'lw_bl1_filter', name: 'Clean the blower intake filters', sensorId: 'bl1_amps', dir: 'above', band: 'caution', why: 'A blocked intake filter makes the blower draw more current', at: T('2026-09-01T09:00'), by: 'Sunny Verma' },
      { id: 'lw_at1_sludge', name: 'Waste extra sludge', sensorId: 'at1_mlss', dir: 'above', band: 'minor', filedAt: 'at1', why: 'MLSS above the line means too much sludge in the aeration tank', at: T('2026-09-01T09:00'), by: 'Sunny Verma' },
    ],
  };
  /* v7/3 (card D1): the plant's structure — unit processes above equipment, control groups beside them — from structure73.js */
  /* v7/4: a plant's structure starts as the proposal read from the Visualization and can then be changed by hand. The first change
     copies the proposal into the plant's own state (so it is kept, and Reset the story brings the proposal back); every reader goes
     through structOf, so tasks, filing and chips follow the change. A live plant's structure changes only with a reason. */
  const structOf = (key) => { const P = S && S.plants && S.plants[key]; return (P && P.struct) || (window.V7_STRUCTURE && window.V7_STRUCTURE[key]) || { state: 'none', ups: [], cgs: [], unplaced: [] }; };
  const upTypeOf = (typeId) => (window.V7NODES && window.V7NODES.upByKey && window.V7NODES.upByKey[typeId]) || null;
  function structDraft(key) {
    const P = PS(key); if (!P || !dOf(key)) return null;
    if (!P.struct) {
      const st = JSON.parse(JSON.stringify(structOf(key))); st.ups = st.ups || []; st.cgs = st.cgs || []; st.unplaced = st.unplaced || []; st.left = [];
      Object.entries(P.placed || {}).forEach(([eqId, up]) => { const u = st.ups.find((x) => x.id === up); if (u && !u.members.some((m) => m.eqId === eqId)) u.members.push({ eqId, tag: (eqRaw(key, eqId) || {}).tag || eqId, role: 'Placed by hand' }); else if (!u) st.left.push(eqId); st.unplaced = st.unplaced.filter((x) => x !== eqId); });
      P.placed = {}; P.struct = st;
    }
    return P.struct;
  }
  const structWhy = (key, o) => (PS(key).state === 'live' && !String((o && o.reason) || '').trim() ? { ok: false, error: 'Say why: a live plant\'s structure changes only with a reason.' } : null);
  const structDone = (key, text, o) => { const r = String((o && o.reason) || '').trim(); addActivity(now(), key, text + (r ? ` — “${r}”` : ''), 'config'); touch(); persist(); return { ok: true, text }; };
  const inAnyUp = (st, eqId) => st.ups.some((u) => u.id === eqId || u.members.some((m) => m.eqId === eqId));
  const settle = (st, eqId) => { st.unplaced = st.unplaced.filter((x) => x !== eqId); if (!inAnyUp(st, eqId) && !(st.left || []).includes(eqId)) st.unplaced.push(eqId); };
  function structMove(key, st, eqId, fromId, toId) {
    const from = st.ups.find((u) => u.id === fromId); let role = 'Placed by hand';
    if (from) { const m = from.members.find((x) => x.eqId === eqId); if (m && m.role) role = m.role; from.members = from.members.filter((x) => x.eqId !== eqId); }
    const to = st.ups.find((u) => u.id === toId); st.left = (st.left || []).filter((x) => x !== eqId);
    if (to && to.id !== eqId && !to.members.some((m) => m.eqId === eqId)) to.members.push({ eqId, tag: (eqRaw(key, eqId) || {}).tag || eqId, role });
    settle(st, eqId); return to || null;
  }
  const tagOfEq = (key, id) => (eqRaw(key, id) || {}).tag || id;
  function addUnitProcess(key, o) {
    const st = structDraft(key); if (!st) return { ok: false, error: 'No such plant.' }; const x = o || {}; const e = eqRaw(key, x.eqId); const t = upTypeOf(x.typeId);
    if (!e) return { ok: false, error: 'Choose the tank or reactor at its centre.' }; if (!t) return { ok: false, error: 'Choose its type from the unit process library.' };
    if (/pump|blower|valve/i.test(e.type || '')) return { ok: false, error: 'A pump, a blower or a valve is never a unit process: it takes part in one.' };
    if (st.ups.some((u) => u.id === e.id)) return { ok: false, error: `${e.tag} is already a unit process.` };
    const why = structWhy(key, x); if (why) return why;
    st.ups.push({ id: e.id, tag: e.tag, name: e.name, typeId: x.typeId, typeName: t.name, stage: t.group || null, stageLabel: t.groupLabel || '', why: 'Added by hand', members: [], byHand: true });
    st.left = (st.left || []).filter((id) => id !== e.id); settle(st, e.id); if (st.state === 'none') st.state = 'open';
    return structDone(key, `Unit process added by hand: ${e.tag}, ${t.name}`, x);
  }
  function setUnitProcess(key, id, o) {
    const st = structDraft(key); if (!st) return { ok: false, error: 'No such plant.' }; const x = o || {}; const u = st.ups.find((y) => y.id === id); if (!u) return { ok: false, error: 'No such unit process.' };
    const t = x.typeId ? upTypeOf(x.typeId) : null; if (x.typeId && !t) return { ok: false, error: 'No such type.' };
    const moves = (x.moves || []).filter((m) => m && m.eqId && m.to != null && m.to !== ''); const add = (x.add || []).filter(Boolean); const bits = [];
    if (!(t && x.typeId !== u.typeId) && !moves.length && !add.length) return { ok: true, text: '', nothing: true };
    const why = structWhy(key, x); if (why) return why;
    if (t && x.typeId !== u.typeId) { u.typeId = x.typeId; u.typeName = t.name; u.stage = t.group || null; u.stageLabel = t.groupLabel || ''; u.why = 'Type set by hand'; bits.push(`type set to ${t.name}`); }
    moves.forEach((m) => { const to = structMove(key, st, m.eqId, u.id, m.to === '__out' ? null : m.to); bits.push(to ? `${tagOfEq(key, m.eqId)} moved to ${to.tag}` : `${tagOfEq(key, m.eqId)} taken out`); });
    add.forEach((eqId) => { if (eqRaw(key, eqId) && eqId !== u.id && !u.members.some((m) => m.eqId === eqId)) { structMove(key, st, eqId, null, u.id); bits.push(`${tagOfEq(key, eqId)} added`); } });
    return structDone(key, `Unit process ${u.tag}: ${bits.join('; ')}`, x);
  }
  function removeUnitProcess(key, id, o) {
    const st = structDraft(key); if (!st) return { ok: false, error: 'No such plant.' }; const u = st.ups.find((y) => y.id === id); if (!u) return { ok: false, error: 'No such unit process.' };
    const why = structWhy(key, o); if (why) return why;
    st.ups = st.ups.filter((y) => y.id !== id); u.members.forEach((m) => settle(st, m.eqId)); settle(st, id);
    return structDone(key, `Unit process removed: ${u.tag}, ${u.typeName}. ${u.tag} is equipment again${u.members.length ? '. Equipment that took part only in it is listed as not placed' : ''}`, o);
  }
  function placeEquipment(key, eqId, toId, o) {
    const st = structDraft(key); if (!st) return { ok: false, error: 'No such plant.' }; if (!eqRaw(key, eqId)) return { ok: false, error: 'No such equipment.' };
    const why = structWhy(key, o); if (why) return why;
    if (!toId) { st.left = (st.left || []).filter((x) => x !== eqId).concat([eqId]); st.unplaced = st.unplaced.filter((x) => x !== eqId); return structDone(key, `${tagOfEq(key, eqId)} left on the plant`, o); }
    const to = structMove(key, st, eqId, null, toId); return to ? structDone(key, `${tagOfEq(key, eqId)} placed in ${to.tag}`, o) : { ok: false, error: 'No such unit process.' };
  }
  function saveControlGroup(key, id, o) {
    const st = structDraft(key); if (!st) return { ok: false, error: 'No such plant.' }; const x = o || {}; const name = String(x.name || '').trim(); const ids = [...new Set((x.memberIds || []).filter((m) => eqRaw(key, m)))];
    if (!name) return { ok: false, error: 'Give the control group a name.' }; if (ids.length < 2) return { ok: false, error: 'A control group is a set: choose at least two pieces of equipment.' };
    const taken = ids.find((m) => st.cgs.some((c) => c.id !== id && c.memberIds.includes(m))); if (taken) return { ok: false, error: `${tagOfEq(key, taken)} is already in another control group.` };
    const why = structWhy(key, x); if (why) return why;
    let c = id ? st.cgs.find((y) => y.id === id) : null; if (id && !c) return { ok: false, error: 'No such control group.' };
    if (!c) { c = { id: nextId('cg'), name, kind: 'set', memberIds: ids, feeds: [], byHand: true }; st.cgs.push(c); return structDone(key, `Control group added by hand: ${name} (${ids.map((m) => tagOfEq(key, m)).join(', ')})`, x); }
    c.name = name; c.memberIds = ids; return structDone(key, `Control group changed: ${name} (${ids.map((m) => tagOfEq(key, m)).join(', ')})`, x);
  }
  function removeControlGroup(key, id, o) {
    const st = structDraft(key); if (!st) return { ok: false, error: 'No such plant.' }; const c = st.cgs.find((y) => y.id === id); if (!c) return { ok: false, error: 'No such control group.' };
    const why = structWhy(key, o); if (why) return why;
    st.cgs = st.cgs.filter((y) => y.id !== id); return structDone(key, `Control group removed: ${c.name}. Its changeover is no longer one task for the set`, o);
  }
  const upOf = (key, id) => structOf(key).ups.find((u) => u.id === id) || null;
  const cgOfEq = (key, eqId) => structOf(key).cgs.find((c) => c.memberIds.includes(eqId)) || null;
  const SET_JOB = /changeover/i;   /* (card D7) work done once for a duty/standby set: one task per control group */
  const HOME_TO_CONFIRM =['i_mb_bod', 'i_mb_ammonia', 'i_mb_tss', 'i_mb_odour', 'i_ts_yellow'];
  const GROUPED = ['routine', 'work', 'test'];
  const RUN_HOURS_PER_DAY = 20, STANDBY_RUN_HOURS_PER_DAY = 1;   /* v7: the hour meter counts run time: duty equipment ~20 h a day, standby ~1 */
  const LABELS = {
    band: BAND_LABEL,
    alertState: { draft: 'Draft', trial: 'On trial', on: 'On', off: 'Off' },
    plantState: { commissioning: 'Commissioning', live: 'Live' },
    chip: { lib: 'Follows the library', form: 'From the Visualization', changed: 'Plant’s own value', libchanged: 'Library changed since', none: 'No limits yet', next: 'Next phase' },
    reason: { tuned: 'Tuned for this plant', fornow: 'For now, until …', unrecorded: 'Not recorded (changed before reasons were kept)', notinlib: 'Not in the library' },
    overrideState: { ok: 'OK', same: 'Now the same as the library', libchanged: 'Library changed since', review: 'Review due', ended: 'Ended' },
    issueStatus: { open: 'Open', diagnosing: 'Diagnosing', fixing: 'Fixing', verifying: 'Verifying', closed: 'Closed' },
    taskStatus: { upcoming: 'Upcoming', due: 'Due', doing: 'In progress', waiting: 'Starts at go live', armed: 'Waiting for the reading' },
    workType: C.WT_LABEL,
    tier: C.TIER_LABEL,
  };

  /* ── state, ids, cache ─────────────────────────────────────────────────────────────────────── */
  let S = null;
  let rev = 0; const memo = new Map();
  const touch = () => { rev++; memo.clear(); };
  const cached = (k, fn) => { if (memo.has(k)) return memo.get(k); const v = fn(); memo.set(k, v); return v; };
  const nextId = (p) => { S.seq = (S.seq || 0) + 1; return `${p}_${S.seq.toString(36)}`; };
  window.CTL_UID = (p) => (S ? nextId(p) : `${p}_${Math.random().toString(36).slice(2, 8)}`);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const now = () => (S ? S.now : NOW0);
  const libPrint = () => (typeof C.libPrint === 'function' ? C.libPrint() : '');

  /* ── hashing (deterministic samples) ───────────────────────────────────────────────────────── */
  const h32 = (str) => { let h = 2166136261; const s = String(str); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const mix = (seed, n) => { let h = (seed ^ Math.imul((n | 0) + 0x632be5ab, 0x9e3779b1)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const h36 = (s) => h32(s).toString(36);

  /* ── time and words ────────────────────────────────────────────────────────────────────────── */
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  const parts = (ms) => { const d = new Date(ms + IST); return { wd: WD[d.getUTCDay()], day: d.getUTCDate(), mon: MO[d.getUTCMonth()], y: d.getUTCFullYear(), hh: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()), iso: d.toISOString().slice(0, 10) }; };
  const fmt = (ms) => { if (ms == null) return '—'; const p = parts(ms); return `${p.wd} ${p.day} ${p.mon}, ${p.hh}:${p.mm}`; };
  const fmtDay = (ms) => { if (ms == null) return '—'; const p = parts(ms); return `${p.wd} ${p.day} ${p.mon}`; };
  const fmtDate = (ms) => { if (ms == null) return '—'; const p = parts(ms); return `${p.day} ${p.mon} ${p.y}`; };
  const fmtTime = (ms) => { if (ms == null) return '—'; const p = parts(ms); return `${p.hh}:${p.mm}`; };
  const isoDay = (ms) => parts(ms).iso;
  const fmtDur = (min) => { if (min == null) return '—'; const m = Math.round(min); if (m < 60) return `${m} min`; if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; } const d = Math.round(m / 144) / 10; return `${d} ${d === 1 ? 'day' : 'days'}`; };
  const toMs = (date) => { if (date == null || date === '') return null; if (typeof date === 'number') return date; const s = String(date); if (/^\d{4}-\d\d-\d\d$/.test(s)) return T(`${s}T06:00`); const p = Date.parse(s); return Number.isFinite(p) ? p : null; };
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const round = (v, dp) => { const p = Math.pow(10, dp); return Math.round(v * p) / p; };
  const fmtNum = (v) => { const a = Math.abs(v); if (a >= 1000) return String(Math.round(v)); if (a >= 10) return Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1); const r2 = Math.round(v * 100) / 100; return Number.isInteger(Math.round(r2 * 10 * 1000) / 1000) ? r2.toFixed(1) : r2.toFixed(2); };
  const fmtVal = (v, unit, kind) => { if (v == null || Number.isNaN(v)) return '—'; if (kind === 'status') return v >= 0.5 ? 'ON' : 'OFF'; const n = fmtNum(v); if (!unit) return n; if (unit === '%') return `${n}%`; if (unit === 'pH') return `pH ${n}`; return `${n} ${unit}`; };
  const dirWord = (dir) => (dir === 'below' ? 'below' : 'above');
  const sname = (s) => (s && s.tag ? `${s.name} (${s.tag})` : s ? s.name : 'the reading');
  const said = (s, v) => (s && s.unit === 'pH' ? fmtVal(v, s.unit, s.kind) : `${s ? s.name : 'The reading'} ${fmtVal(v, s && s.unit, s && s.kind)}`);
  const bandChange = (b, from, to, unit, kind) => (from == null ? `${BAND_LABEL[b]} set at ${fmtVal(to, unit, kind)}` : to == null ? `${BAND_LABEL[b]} removed (was ${fmtVal(from, unit, kind)})` : `${BAND_LABEL[b]} ${fmtVal(from, unit, kind)} → ${fmtVal(to, unit, kind)}`);
  const limitsText = (bands, dir, unit, kind) => BANDS.filter((b) => bands && bands[b] != null).map((b) => (kind === 'status' ? `${BAND_LABEL[b]} when ${fmtVal(bands[b], unit, kind)}` : `${BAND_LABEL[b]} ${dirWord(dir)} ${fmtVal(bands[b], unit, kind)}`)).join(' · ') || 'No limits yet';
  const sevClock = (band) => { const c = C.SEV_CLOCK[band]; if (!c || c[0] == null) return 'Caution: in the app and the morning email; no clock'; return `Start within ${C.fmtH(c[0])}, fix within ${C.fmtH(c[1])}`; };
  const noun = (typeName, n) => { const w = /^[A-Z][a-z]/.test(typeName) && !/[A-Z]{2}/.test(typeName) ? typeName.toLowerCase() : typeName; return n === 1 ? w : (/(s|x|sh|ch)$/i.test(w) ? w + 'es' : w + 's'); };
  const everyText = (ev) => { if (!ev || !ev.n) return 'no cadence'; return `every ${ev.n === 1 ? '' : ev.n + ' '}${ev.unit}${ev.n > 1 ? 's' : ''}`; };

  /* ── plant access ──────────────────────────────────────────────────────────────────────────── */
  const PS = (key) => (S && S.plants[key]) || null;
  const dOf = (key) => { const p = C.S.plants[key]; return p ? p.d : null; };
  const withPlant = (key, fn) => C.withPlant(key, fn);
  const eqRaw = (key, id) => (dOf(key) ? dOf(key).equipment.find((e) => e.id === id) || null : null);
  /* a manual or lab reading (a plant's manual test, rule 14) is addressed as 'm:<scheduleId>': same limits path, no samples */
  const manualSensor = (key, scId) => { const d = dOf(key); const sc = d ? d.schedules.find((x) => x.id === scId) : null; if (!sc || sc.workType !== 'test') return null; return { id: 'm:' + scId, name: sc.name.replace(/^Manual testing\s*-\s*/i, ''), tag: null, unit: '', kind: 'manual', valid: [-1e9, 1e9], on: sc.subject && sc.subject.kind === 'eq' ? 'eq:' + sc.subject.id : 'plant', direction: null, limits: null, manual: true, scheduleId: scId }; };
  const sensorRaw = (key, id) => { const d = dOf(key); if (!d) return null; if (typeof id === 'string' && id.startsWith('m:')) return manualSensor(key, id.slice(2)); return d.sensors.find((s) => s.id === id) || null; };
  const alertRaw = (key, id) => (dOf(key) ? dOf(key).alerts.find((a) => a.id === id) || null : null);
  const schedRaw = (key, id) => (dOf(key) ? dOf(key).schedules.find((s) => s.id === id) || null : null);
  const homeOf = (key, s) => (s && typeof s.on === 'string' && s.on.startsWith('eq:') ? eqRaw(key, s.on.slice(3)) : null);
  const alertDir = (key, a) => { if (a.limits === 'custom') return a.direction || 'above'; const s = sensorRaw(key, a.sensor); return (s && s.direction) || 'below'; };
  const alertEq = (key, a) => (a && a.subject && a.subject.kind === 'eq' ? eqRaw(key, a.subject.id) : null);
  const plantName = (key) => (dOf(key) && dOf(key).plant.name) || key;
  const rtOffset = (ms) => Math.round((ms - RT.BASE) / MIN);
  const syncClocks = () => { ORDER.forEach((k) => { const d = dOf(k); if (d) { if (!d.rt) d.rt = { records: [], messages: [], offset: 0 }; d.rt.offset = rtOffset(now()); } }); };

  /* ── library lookups ───────────────────────────────────────────────────────────────────────── */
  const sets = () => C.S.lib.standardSets;
  const setOf = (typeName) => sets().find((t) => t.type === typeName) || null;
  const catByCode = (code) => (window.CATALOGUE_BY_CODE && window.CATALOGUE_BY_CODE[code]) || null;
  const catByType = (typeName) => (window.CATALOGUE_BY_TYPE && window.CATALOGUE_BY_TYPE[typeName]) || null;
  const codeOfType = (typeName) => (catByType(typeName) || {}).code || null;
  const norm4 = (lim) => ({ caution: lim && lim.caution != null ? lim.caution : null, minor: lim && lim.minor != null ? lim.minor : null, major: lim && lim.major != null ? lim.major : null, emergency: lim && lim.emergency != null ? lim.emergency : null });
  const sparse = (lim) => { const o = {}; BANDS.forEach((b) => { if (lim[b] != null) o[b] = lim[b]; }); return o; };
  const hasAny = (lim) => !!lim && BANDS.some((b) => lim[b] != null);
  const same = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-9);
  const sameEvery = (a, b) => (!a && !b) || (!!a && !!b && a.n === b.n && a.unit === b.unit);
  const libAlertFor = (typeName, reading, dir) => { const t = setOf(typeName); return t ? t.alerts.find((a) => a.sensorKind === reading && a.direction === dir) || null : null; };
  const draftOf = (typeName) => { const code = codeOfType(typeName); return code && S ? S.lib.drafts[code] || null : null; };
  function libBands(typeName, reading, dir, useDraft) {
    if (useDraft) { const dr = draftOf(typeName); const k = `${reading}|${dir}`; if (dr && dr.limits[k]) return norm4(dr.limits[k]); }
    const a = libAlertFor(typeName, reading, dir); return a ? norm4(a.limits) : null;
  }
  const libSchedFor = (typeName, name) => { const t = setOf(typeName); return t ? t.schedules.find((x) => x.name === name) || null : null; };
  const libRound = (plantType, name) => { const prof = (window.PLANT_PROFILES || {})[plantType] || null; return prof ? prof.rounds.find((r) => r.name === name) || null : null; };
  const libEveryOf = (x) => (x ? C.cadenceOf(x) : null);
  /* v7: a schedule's whole "how often" with a new calendar interval, its run-hours part kept: "every 3 months or 500 run-hours" */
  const everyWith = (sc, ev) => { if (!sc) return everyText(ev); if (sc.basis === 'meter' && ev && ev.unit === 'hour') return `every ${ev.n} run-hours`; return C.every({ ...sc, every: ev ? { ...ev } : sc.every }); };
  function libTiming(typeName, reading, dir, which, useDraft) {
    const ta = libAlertFor(typeName, reading, dir); if (!ta) return null;
    if (useDraft) { const dr = draftOf(typeName); const x = dr && dr.alerts[ta.name]; if (x && x[which] != null) return x[which]; }
    if (which === 'hold') return ta.hold != null ? ta.hold : (ta.limits && ta.limits.emergency != null ? 0 : 5);
    return ta.clear != null ? ta.clear : 10;
  }

  /* ── the Visualization ────────────────────────────────────────────────────────────────────────── */
  function formSet(key, e, reading, dir) {
    if (!e) return null;
    return cached(`form:${key}:${e.id}:${reading}:${dir}`, () => withPlant(key, () => {
      C.ensureForm(e);
      const dl = C.derivedLimits(e, reading);
      if (dl && dl.dir === dir) return { lim: norm4(dl.lim), why: cap(String(dl.why || 'from the Visualization')) };
      const fa = (C.formItems(e).alerts || []).find((a) => a.sensorKind === reading && a.direction === dir);
      return fa ? { lim: norm4(fa.limits), why: 'From the Visualization' } : null;
    }));
  }

  /* ── the override ledger ───────────────────────────────────────────────────────────────────── */
  const findOv = (key, pred) => (S ? S.overrides.find((o) => o.plant === key && !o.endedAt && pred(o.target)) || null : null);
  const ovLimit = (key, sid, dir, band) => findOv(key, (t) => t.kind === 'limit' && t.sensorId === sid && t.dir === dir && t.band === band);
  const ovReading = (key, sid, dir) => findOv(key, (t) => t.kind === 'reading' && t.sensorId === sid && t.dir === dir);
  const ovTiming = (key, alertId, which) => findOv(key, (t) => t.kind === which && t.alertId === alertId);
  const ovCadence = (key, scId) => findOv(key, (t) => t.kind === 'cadence' && t.scheduleId === scId);
  const ovTier = (key, eqId) => findOv(key, (t) => t.kind === 'tier' && t.eqId === eqId);
  const ovOnOff = (key, x) => findOv(key, (t) => t.kind === 'onoff' && ((x.alertId && t.alertId === x.alertId) || (x.scheduleId && t.scheduleId === x.scheduleId)));
  function addOverride(key, target, value, base, opts, at) {
    const o = { id: nextId('ov'), plant: key, target, value, base: base === undefined ? null : base, reason: opts.reason, note: opts.note || '', until: opts.reason === 'fornow' ? toMs(opts.until) : null, reviewBy: opts.reviewBy !== undefined ? opts.reviewBy : opts.reason === 'fornow' ? toMs(opts.until) : opts.reason === 'tuned' ? (at || now()) + 182 * DAY : null, author: opts.author !== undefined ? opts.author : ME, at: at !== undefined ? at : now(), endedAt: null, endedNote: null };
    S.overrides.push(o); return o;
  }
  function endOverride(o, note, at) { o.endedAt = at != null ? at : now(); o.endedNote = note; }
  const chipText = (chip, why) => (chip === 'form' && why ? why : LABELS.chip[chip]);
  function checkReason(opts) {
    const o = opts || {};
    if (o.reason !== 'tuned' && o.reason !== 'fornow') return 'Say why it differs from the library: Tuned for this plant, or For now, until a date.';
    if (!String(o.note || '').trim()) return 'Write a short note: what you saw that makes this plant different.';
    if (o.reason === 'fornow') { const u = toMs(o.until); if (!u || u <= now()) return 'Pick the date it goes back to the library (after today).'; }
    return null;
  }

  /* ── limits and where each band comes from ─────────────────────────────────────────────────── */
  function bandsInfo(key, sensorId, dir, opt) {
    const draft = !!(opt && opt.draft);
    return cached(`bands:${key}:${sensorId}:${dir}:${draft ? 1 : 0}`, () => {
      const s = sensorRaw(key, sensorId); if (!s) return null;
      const e = homeOf(key, s); const kind = s.kind;
      const out = { sensorId, dir, unit: s.unit, kind, nextPhase: !!s.nextPhase, bands: norm4(null), perBand: {}, libBands: null, formBands: null, formWhy: null, notInLib: false };
      if (s.nextPhase) { BANDS.forEach((b) => { out.perBand[b] = { value: null, chip: 'next', chipText: LABELS.chip.next, libValue: null, baseValue: null, base: null, overrideId: null }; }); return out; }
      const lib = e ? libBands(e.type, s.name, dir, draft) : null;
      const fs = e ? formSet(key, e, s.name, dir) : null;
      out.libBands = lib; out.formBands = fs ? fs.lim : null; out.formWhy = fs ? fs.why : null;
      const rov = ovReading(key, sensorId, dir);
      out.notInLib = !!rov;
      BANDS.forEach((b) => {
        const formV = fs ? fs.lim[b] : null, libV = lib ? lib[b] : null;
        const baseV = formV != null ? formV : libV;
        const baseChip = formV != null ? 'form' : libV != null ? 'lib' : fs ? 'form' : lib ? 'lib' : 'none';
        const pb = { value: baseV, chip: baseChip, chipText: chipText(baseChip, out.formWhy), libValue: libV, formValue: formV, baseValue: baseV, base: null, overrideId: null };
        if (rov) { Object.assign(pb, { value: rov.value ? rov.value[b] : null, chip: 'changed', chipText: LABELS.chip.changed, base: null, overrideId: rov.id }); }
        else {
          const ov = ovLimit(key, sensorId, dir, b);
          /* v7: "Library changed since" only while the plant's value still differs from the base now (else its state is "Now the same") */
          if (ov) { const ch = same(ov.base, baseV) || same(ov.value, baseV) ? 'changed' : 'libchanged'; Object.assign(pb, { value: ov.value, chip: ch, chipText: LABELS.chip[ch], base: ov.base, overrideId: ov.id }); }
        }
        out.perBand[b] = pb; out.bands[b] = pb.value;
      });
      if (!hasAny(out.bands) && !lib && !fs && !rov) BANDS.forEach((b) => { out.perBand[b].chip = 'none'; out.perBand[b].chipText = LABELS.chip.none; });
      return out;
    });
  }
  function dirsOf(key, sensorId) {
    const s = sensorRaw(key, sensorId); if (!s) return [];
    const e = homeOf(key, s); const d = dOf(key); const set = new Set();
    d.alerts.filter((a) => a.sensor === sensorId).forEach((a) => set.add(alertDir(key, a)));
    if (s.direction && hasAny(s.limits)) set.add(s.direction);
    if (e) { const t = setOf(e.type); if (t) t.alerts.filter((a) => a.sensorKind === s.name).forEach((a) => set.add(a.direction)); ['above', 'below'].forEach((dir) => { if (formSet(key, e, s.name, dir)) set.add(dir); }); }
    S.overrides.filter((o) => o.plant === key && !o.endedAt && o.target.sensorId === sensorId && o.target.dir).forEach((o) => set.add(o.target.dir));
    if (!set.size) set.add(s.direction || (C.readingOf(s.name) || {}).direction || 'above');
    return ['above', 'below'].filter((x) => set.has(x));
  }
  const primaryDir = (key, sensorId) => { const a = dOf(key).alerts.find((x) => x.sensor === sensorId); if (a) return alertDir(key, a); return dirsOf(key, sensorId)[0] || 'above'; };
  function limitsOf(key, sensorId, dir) { const dr = dir || primaryDir(key, sensorId); return bandsInfo(key, sensorId, dr); }
  function libLimits(typeName, readingName, dir, opts) {
    const cur = libBands(typeName, readingName, dir, false); const dr = libBands(typeName, readingName, dir, true);
    const ta = libAlertFor(typeName, readingName, dir); const r = C.readingOf(readingName) || {};
    const perBand = {}; BANDS.forEach((b) => { const v = opts && opts.draft ? (dr ? dr[b] : null) : (cur ? cur[b] : null); perBand[b] = { value: v, chip: cur || dr ? 'lib' : 'none', chipText: cur || dr ? LABELS.chip.lib : LABELS.chip.none, libValue: cur ? cur[b] : null, draftValue: dr && !same(dr[b], cur ? cur[b] : null) ? dr[b] : undefined }; });
    return { typeName, reading: readingName, dir, unit: r.unit || '', alertName: ta ? ta.name : null, bands: opts && opts.draft ? (dr || norm4(null)) : (cur || norm4(null)), draftBands: dr && JSON.stringify(dr) !== JSON.stringify(cur) ? dr : null, perBand, hold: libTiming(typeName, readingName, dir, 'hold', opts && opts.draft), clear: libTiming(typeName, readingName, dir, 'clear', opts && opts.draft) };
  }
  function timingInfo(key, alertId, which, opt) {
    return cached(`timing:${key}:${alertId}:${which}:${opt && opt.draft ? 1 : 0}`, () => {
      const a = alertRaw(key, alertId); if (!a) return null;
      const s = sensorRaw(key, a.sensor); const e = alertEq(key, a); const dir = alertDir(key, a);
      const libV = e && s ? libTiming(e.type, s.name, dir, which, opt && opt.draft) : null;
      const inPlace = which === 'hold' ? (a.holdMin != null ? a.holdMin : 5) : (a.closes && a.closes.holdMin != null ? a.closes.holdMin : 10);
      const ov = ovTiming(key, alertId, which);
      if (ov) { const ch = same(ov.base, libV) || same(ov.value, libV) ? 'changed' : 'libchanged'; return { value: ov.value, chip: ch, chipText: LABELS.chip[ch], libValue: libV, base: ov.base, overrideId: ov.id }; }
      if (libV != null) return { value: libV, chip: 'lib', chipText: LABELS.chip.lib, libValue: libV, base: null, overrideId: null };
      return { value: inPlace, chip: 'notinlib', chipText: LABELS.reason.notinlib, libValue: null, base: null, overrideId: null, notInLib: true };   /* v7: never "Changed here" without a difference to show */
    });
  }
  function libEveryForSched(key, sc, useDraft) {
    const d = dOf(key); let x = null;
    if (sc.subject.kind === 'eq') { const e = eqRaw(key, sc.subject.id); if (e) { if (useDraft) { const dr = draftOf(e.type); if (dr && dr.schedules[sc.name]) return dr.schedules[sc.name]; } x = libSchedFor(e.type, sc.name); } }
    else x = libRound(d.plant.type, sc.name);
    if (x) return libEveryOf(x);
    if (sc.workType === 'calibration' && sc.probe) return { n: 1, unit: 'month' };   /* every probe on the equipment: calibrated monthly */
    return null;
  }
  /* v7: a task the Visualization proposes (no library schedule of that name): its cadence is "From the Visualization" (rule 8: override → form → library) */
  function formEveryForSched(key, sc) {
    if (!sc || !sc.subject || sc.subject.kind !== 'eq') return null; const e = eqRaw(key, sc.subject.id); if (!e) return null;
    return cached(`formev:${key}:${e.id}:${sc.name}`, () => withPlant(key, () => { C.ensureForm(e); const fs = (C.formItems(e).schedules || []).find((x) => x.name === sc.name); return fs ? C.cadenceOf(fs) : null; }));
  }
  function cadenceInfo(key, scId, opt) {
    return cached(`cad:${key}:${scId}:${opt && opt.draft ? 1 : 0}`, () => {
      const sc = schedRaw(key, scId); if (!sc) return null;
      const libV = libEveryForSched(key, sc, opt && opt.draft);
      const formV = libV ? null : formEveryForSched(key, sc); const baseV = libV || formV; const baseFrom = libV ? 'lib' : formV ? 'form' : null;
      const ov = ovCadence(key, scId);
      const cur = C.cadenceOf(sc);
      if (ov && ov.reason === 'notinlib') return { value: ov.value || cur, chip: 'changed', chipText: LABELS.chip.changed, libValue: null, base: null, overrideId: ov.id, notInLib: true, notInLibText: LABELS.reason.notinlib };
      if (ov) { const ch = sameEvery(ov.base, baseV) || sameEvery(ov.value, baseV) ? 'changed' : 'libchanged'; return { value: ov.value, chip: ch, chipText: LABELS.chip[ch], libValue: baseV, base: ov.base, overrideId: ov.id, baseFrom }; }
      if (libV) return { value: libV, chip: 'lib', chipText: LABELS.chip.lib, libValue: libV, base: null, overrideId: null, baseFrom };
      if (formV) return { value: formV, chip: 'form', chipText: LABELS.chip.form, libValue: formV, formValue: formV, base: null, overrideId: null, baseFrom };
      /* v7: no library value, no form value and no ledger entry: say so plainly (never "Changed here" without a difference to show) */
      return { value: cur, chip: 'notinlib', chipText: LABELS.reason.notinlib, libValue: null, base: null, overrideId: null, notInLib: true, notInLibText: LABELS.reason.notinlib };
    });
  }
  /* v7: the run-hours part of a task that runs on its hour meter ("every 6 months or 500 run-hours"): its own value, base = the library's */
  function runHoursInfo(key, scId) {
    const sc = schedRaw(key, scId); if (!sc || !sc.meter) return null; const e = sc.subject.kind === 'eq' ? eqRaw(key, sc.subject.id) : null;
    const ls = e ? libSchedFor(e.type, sc.name) : null; const libV = ls && ls.meterHours ? ls.meterHours : null;
    const ov = findOv(key, (t) => t.kind === 'runhours' && t.scheduleId === scId);
    if (ov) { const ch = same(ov.base, libV) || same(ov.value, libV) ? 'changed' : 'libchanged'; return { value: ov.value, chip: ch, chipText: LABELS.chip[ch], libValue: libV, base: ov.base, overrideId: ov.id }; }
    if (libV != null) return { value: sc.meter.hours, chip: same(libV, sc.meter.hours) ? 'lib' : 'changed', chipText: same(libV, sc.meter.hours) ? LABELS.chip.lib : LABELS.chip.changed, libValue: libV, base: null, overrideId: null };
    return { value: sc.meter.hours, chip: 'notinlib', chipText: LABELS.reason.notinlib, libValue: null, base: null, overrideId: null, notInLib: true };
  }
  /* v7: with no run-hours difference left (back to the library, or a "For now" date came) the meter goes back to the library's run-hours */
  function syncRunHours(key, scId) { const sc = schedRaw(key, scId); if (!sc || !sc.meter) return; touch(); const ri = runHoursInfo(key, scId); const v = !ri ? null : ri.overrideId ? ri.value : ri.libValue != null ? ri.libValue : ri.value; if (v) { sc.meter.hours = v; if (sc.basis === 'meter') sc.every = { n: v, unit: 'hour' }; } touch(); }
  function tierInfo(key, eqId) {
    const e = eqRaw(key, eqId); if (!e) return null; const cat = catByType(e.type); const libV = cat ? cat.tier : null; const ov = ovTier(key, eqId);
    if (ov) { const ch = ov.base === libV || ov.value === libV ? 'changed' : 'libchanged'; return { value: ov.value, chip: ch, chipText: LABELS.chip[ch], libValue: libV, base: ov.base, overrideId: ov.id, note: ov.note }; }
    return { value: libV || e.tier, chip: libV ? 'lib' : 'notinlib', chipText: libV ? LABELS.chip.lib : LABELS.reason.notinlib, libValue: libV, base: null, overrideId: null };
  }
  function sourceOf(key, target) {
    const t = target || {};
    if (t.kind === 'limit') { const bi = bandsInfo(key, t.sensorId, t.dir || primaryDir(key, t.sensorId)); return bi ? bi.perBand[t.band] : null; }
    if (t.kind === 'reading') return bandsInfo(key, t.sensorId, t.dir);
    if (t.kind === 'hold' || t.kind === 'clear') return timingInfo(key, t.alertId, t.kind);
    if (t.kind === 'cadence') return cadenceInfo(key, t.scheduleId);
    if (t.kind === 'tier') return tierInfo(key, t.eqId);
    if (t.kind === 'runhours') return runHoursInfo(key, t.scheduleId);
    if (t.kind === 'onoff') { const ov = ovOnOff(key, t); return ov ? { value: 'off', chip: 'changed', chipText: LABELS.chip.changed, libValue: 'on', base: 'on', overrideId: ov.id } : { value: 'on', chip: 'lib', chipText: LABELS.chip.lib, libValue: 'on', base: null, overrideId: null }; }
    return null;
  }

  /* ── writing v6's in-place values (a mirror of what the sources say) ───────────────────────── */
  function syncSensor(key, sensorId) {
    const s = sensorRaw(key, sensorId); if (!s || s.nextPhase) return;
    const d = dOf(key); touch();
    ['above', 'below'].forEach((dir) => {
      const bi = bandsInfo(key, sensorId, dir); const eff = { ...bi.bands };
      const ad = d.alerts.filter((a) => a.sensor === sensorId && alertDir(key, a) === dir);
      ad.filter((a) => a.limits === 'custom').forEach((a) => { a.custom = { ...eff }; });
      /* the sensor's own limits hold the direction the sensor reads (or the one an alert follows); a second direction lives on its alert */
      if (ad.some((a) => a.limits === 'sensor') || s.direction === dir) { s.limits = { ...eff }; s.direction = dir; s.source = BANDS.some((b) => bi.perBand[b].overrideId) ? 'custom' : BANDS.some((b) => bi.perBand[b].chip === 'form') ? 'form' : 'library'; }
    });
    touch();
  }
  function syncAlert(key, alertId) {
    const a = alertRaw(key, alertId); if (!a) return; touch();
    const h = timingInfo(key, alertId, 'hold'), c = timingInfo(key, alertId, 'clear');
    if (h) a.holdMin = h.value; if (c && a.closes && a.closes.mode === 'sensor') a.closes.holdMin = c.value; touch();
  }
  function syncSched(key, scId) { const sc = schedRaw(key, scId); if (!sc) return; touch(); const ci = cadenceInfo(key, scId); if (ci && ci.value && ci.value.n && sc.every) { sc.every = { ...ci.value }; if (sc.basis === 'meter' && sc.meter && ci.value.unit === 'hour') sc.meter.hours = ci.value.n; } touch(); }   /* v7: meter-only work keeps its meter in step */
  function syncTier(key, eqId) { const e = eqRaw(key, eqId); if (!e) return; touch(); const ti = tierInfo(key, eqId); e.tier = ti.value; if (ti.overrideId) e.tierReason = ti.note || e.tierReason; else delete e.tierReason; touch(); }
  function syncEquipment(key, eqId) { const d = dOf(key); d.sensors.filter((s) => s.on === 'eq:' + eqId).forEach((s) => syncSensor(key, s.id)); d.alerts.filter((a) => a.subject && a.subject.id === eqId).forEach((a) => syncAlert(key, a.id)); d.schedules.filter((x) => x.subject && x.subject.id === eqId).forEach((x) => syncSched(key, x.id)); }

  /* ── sample readings: one pure function per sensor ─────────────────────────────────────────── */
  const slotOf = (t) => Math.floor((t - GRID0) / POLL);
  const pollAt = (k) => GRID0 + k * POLL;
  const firstPollAtOrAfter = (t) => pollAt(Math.ceil((t - GRID0) / POLL));
  const firstPollAfter = (t) => pollAt(Math.floor((t - GRID0) / POLL) + 1);
  const lastPollAtOrBefore = (t) => pollAt(Math.floor((t - GRID0) / POLL));
  const hourIST = (t) => ((((t + IST) % DAY) + DAY) % DAY) / HOUR;
  const dayIST = (t) => Math.floor((t + IST) / DAY);
  const pollOfDay = (t) => Math.floor(((((t + IST) % DAY) + DAY) % DAY) / POLL);
  const onPoll = (t, at) => Math.abs(t - at) < 1000;
  const profiles = new Map();
  function seedReadingOf(key, s, e) {
    if (key === 'manesar') { const s0 = (window.SEED.sensors || []).find((x) => x.id === s.id); if (s0) return s0.reading; }
    const sm = window.SCADA_SAMPLES && window.SCADA_SAMPLES[key]; const se = sm && e ? sm.equipment.find((x) => x.id === e.id) : null;
    const ss = se && se.sensors ? se.sensors.find((x) => s.scadaTag && x.tag === s.scadaTag) : null;
    if (ss && ss.reading != null) return ss.reading;
    const cat = e ? catByType(e.type) : null; const cs = cat ? cat.sensors.find((x) => x.name === s.name) : null;
    return cs ? cs.reading : (s.valid[0] + s.valid[1]) / 2;
  }
  function refLimits(key, s, e) {
    const out = { above: null, below: null };
    if (key === 'manesar') {
      const s0 = (window.SEED.sensors || []).find((x) => x.id === s.id); if (s0 && s0.direction && hasAny(s0.limits)) out[s0.direction] = norm4(s0.limits);
      (window.SEED.alerts || []).filter((a) => a.sensor === s.id && a.limits === 'custom').forEach((a) => { out[a.direction] = norm4(a.custom); });
    }
    if (e) ['above', 'below'].forEach((dir) => {
      if (out[dir]) return;
      const dl = withPlant(key, () => { C.ensureForm(e); return C.derivedLimits(e, s.name); });
      if (dl && dl.dir === dir) { out[dir] = norm4(dl.lim); return; }
      const shipped = (window.SEED.standardSets || []).find((t) => t.type === e.type); const ta = shipped ? shipped.alerts.find((a) => a.sensorKind === s.name && a.direction === dir) : null;
      if (ta) out[dir] = norm4(ta.limits);
    });
    const vals = (lim) => (lim ? BANDS.map((b) => lim[b]).filter((v) => v != null) : []);
    const hi = vals(out.above).length ? Math.min(...vals(out.above)) : null; const lo = vals(out.below).length ? Math.max(...vals(out.below)) : null;
    return { hi, lo };
  }
  /* Story readings: each a wave with scripted moments. Values are absolute: changing limits never changes a reading. */
  const VED_SPILL = T('2026-10-28T15:10');
  const MAN_CRASH = T('2026-10-29T07:40'), MAN_RECOVER = T('2026-10-29T09:40'), MAN_DO_QUIET = T('2026-10-30T14:10');   /* v7: back by 09:55, so +1 hour after the fix shows it inside */
  const MAN_STRAIN = T('2026-10-29T14:10'), MAN_STRAIN_END = T('2026-10-31T10:10');
  const MAN_BLANKET = T('2026-10-30T02:10'), MAN_BLANKET_END = T('2026-10-30T04:40');
  const SCRIPT = {
    /* DO in SBR-1: five to seven short dips a day just under 2.0 mg/L, and one longer, deeper one a day: about 6 trial firings a day, mostly short */
    'vedanta:v_sbr_DO': { kind: 'wave', base: 2.62, amp: 0.16, noise: 0.05, phase: 15, dp: 2, event(t, k, p) {
      const day = dayIST(t), pi = pollOfDay(t); const n = 5 + Math.floor(mix(p.seed2, day) * 3);
      const w = Math.floor(pi * n / 96); const ws = Math.floor(w * 96 / n), we = Math.floor((w + 1) * 96 / n);
      const at = ws + 2 + Math.floor(mix(p.seed2, day * 16 + w) * Math.max(1, we - ws - 8)); const longW = Math.floor(mix(p.seed2, day * 16 + 15) * n);
      if (w === longW) { if (pi === at) return 1.78; if (pi === at + 1) return 1.58; if (pi === at + 2) return 1.74; return undefined; }
      if (pi === at) return round(1.83 + 0.14 * mix(p.seed, k), 2); return undefined; } },
    /* EQ-1 level: filled and pumped down every 105 minutes; most cycles go just past 85% for three polls: 11 to 14 trial firings a day */
    'vedanta:v_eq1_LVL': { kind: 'fn', dp: 1, fn(t, k, p) {
      const c = Math.floor(k / 7), pos = ((k % 7) + 7) % 7; const u = mix(p.seed, k) - 0.5;
      if (pos < 4) return [52, 60.5, 69, 77.5][pos] + u * 2;
      return (mix(p.seed2, c) < 0.92 ? [85.8, 87.4, 86.0] : [82.0, 83.6, 82.4])[pos - 4] + u * 1.2; } },
    /* EQ-1 pH: steady, then an acid spill on Wed 28 Oct at 15:10 (Emergency at 3.7) that clears by 16:10 */
    'vedanta:v_eq1_PH': { kind: 'wave', base: 7.15, amp: 0.12, noise: 0.04, phase: 14, dp: 2, event(t) {
      for (let i = 0; i < 4; i++) if (onPoll(t, VED_SPILL + i * POLL)) return [3.7, 4.6, 5.6, 6.5][i]; return undefined; } },
    /* AT-2 DO at Manesar: now and then a dip in the past; a crash at 07:40 today (Major, under 1.0) until 09:40, when it climbs back
       (1.6 at 09:40, 2.1 at 09:55, inside the limits after that). No dips again until Sat 31 Oct 14:10. */
    'manesar:at2_do': { kind: 'wave', base: 2.5, amp: 0.15, noise: 0.05, phase: 14, dp: 2, event(t, k, p) {
      if (t >= MAN_CRASH && t < MAN_RECOVER) return round(0.62 + 0.34 * mix(p.seed, k), 2);
      if (onPoll(t, MAN_RECOVER)) return 1.6; if (onPoll(t, MAN_RECOVER + POLL)) return 2.1;
      if (t > MAN_CRASH - DAY && t < MAN_DO_QUIET + DAY) return undefined;
      const day = dayIST(t), pi = pollOfDay(t), r = mix(p.seed2, day); if (r >= 0.33) return undefined;
      const at = 16 + Math.floor(mix(p.seed2, day + 1000) * 60);
      if (pi === at) return round(1.86 + 0.1 * mix(p.seed, k), 2); if (r < 0.08 && pi === at + 1) return 1.45; if (r < 0.08 && pi === at + 2) return 1.72; return undefined; } },
    /* BL-1 motor current: rare short blips in the past; strains above 44 A from 14:10 today until Sat 31 Oct 10:10 */
    'manesar:bl1_amps': { kind: 'wave', base: 38, amp: 1.2, noise: 0.4, phase: 15, dp: 1, event(t, k, p) {
      if (t >= MAN_STRAIN && t < MAN_STRAIN_END) return round(44.6 + 1.6 * mix(p.seed, k), 1);
      if (t > NOW0 - 2 * DAY) return undefined;
      const day = dayIST(t), pi = pollOfDay(t); if (mix(p.seed2, day) >= 0.07) return undefined; const at = 30 + Math.floor(mix(p.seed2, day + 7) * 40);
      if (pi === at || pi === at + 1) return round(44.3 + 0.6 * mix(p.seed, k), 1); return undefined; } },
    /* SC-1 sludge blanket: once two weeks ago, and early on Fri 30 Oct */
    'manesar:cl1_blanket': { kind: 'wave', base: 0.7, amp: 0.05, noise: 0.02, phase: 3, dp: 2, event(t, k, p) {
      if (t >= MAN_BLANKET && t < MAN_BLANKET_END) return round(1.24 + 0.08 * mix(p.seed, k), 2);
      if (t >= T('2026-10-15T10:10') && t < T('2026-10-15T12:10')) return round(1.26 + 0.08 * mix(p.seed, k), 2); return undefined; } },
    /* AT-1 MLSS: twice over 4500 mg/L this month */
    'manesar:at1_mlss': { kind: 'wave', base: 3600, amp: 200, noise: 60, phase: 10, dp: 0, event(t, k, p) {
      if ((t >= T('2026-10-08T11:10') && t < T('2026-10-08T13:40')) || (t >= T('2026-10-21T16:10') && t < T('2026-10-21T18:10'))) return Math.round(4580 + 140 * mix(p.seed, k)); return undefined; } },
  };
  function buildProfile(key, sensorId) {
    const s = sensorRaw(key, sensorId); if (!s) return { kind: 'const', v: 0, valid: [0, 1], dp: 0, seed: 1, seed2: 2 };
    const e = homeOf(key, s); const seed = h32(`${key}:${sensorId}`), seed2 = h32(`${sensorId}:${key}:2`);
    const span = Math.max(1e-6, s.valid[1] - s.valid[0]); const dp = span <= 15 ? 2 : span <= 200 ? 1 : 0;
    const base = { seed, seed2, valid: s.valid.slice(), dp, kindOf: s.kind };
    const sc = SCRIPT[`${key}:${sensorId}`]; if (sc) return { ...base, ...sc };
    const r0 = seedReadingOf(key, s, e);
    if (s.kind === 'status') { if (s.name === 'Run status') return { ...base, kind: 'run', duty: r0 >= 0.5 }; return { ...base, kind: 'const', v: 0 }; }
    if (s.kind === 'meter') return { ...base, kind: 'meter', start: r0 || 0, rate: rateOfEq(e), dp: 1 };   /* v7: counts only while it runs */
    if (s.name === 'Motor current' && !r0) return { ...base, kind: 'const', v: 0 };
    const { hi, lo } = refLimits(key, s, e);
    if (s.name === 'Level' || /tank level/i.test(s.name)) {
      if (lo != null && hi == null) return { ...base, kind: 'drain', top: Math.min(s.valid[1], 92), bottom: lo + 12, days: 7, off: mix(seed, 5) * 7, dp: 1 };
      return { ...base, kind: 'fill', lo: lo != null ? lo + 12 : 35, hi: hi != null ? hi - 15 : 70, period: 24, off: Math.floor(mix(seed, 9) * 24), dp: 1 };
    }
    let b, amp, noise;
    if (s.name === 'pH') { b = 7.2; amp = 0.15; noise = 0.05; if ((hi != null && b > hi - 0.4) || (lo != null && b < lo + 0.4)) b = hi != null && lo != null ? (hi + lo) / 2 : hi != null ? hi - 0.8 : lo + 0.8; }
    else if (hi != null && lo != null) { b = (hi + lo) / 2; amp = 0.12 * (hi - lo); noise = 0.04 * (hi - lo); }
    else if (hi != null) { b = r0 > 0.3 * hi && r0 < 0.88 * hi ? r0 : 0.72 * hi; amp = 0.05 * hi; noise = 0.02 * hi; }
    else if (lo != null) { b = r0 > 1.2 * lo && r0 < 2 * lo ? r0 : 1.3 * lo; amp = 0.05 * lo; noise = 0.02 * lo; }
    else { b = r0 != null ? r0 : (s.valid[0] + s.valid[1]) / 2; amp = 0.03 * span; noise = 0.01 * span; }
    return { ...base, kind: 'wave', base: b, amp, noise, phase: Math.floor(mix(seed, 3) * 24) };
  }
  const profileOf = (key, sensorId) => { const k = `${key}:${sensorId}`; if (!profiles.has(k)) profiles.set(k, buildProfile(key, sensorId)); return profiles.get(k); };
  function valueOf(key, sensorId, t) {
    const p = profileOf(key, sensorId); const k = slotOf(t); let v;
    if (p.event) v = p.event(t, k, p);
    if (v === undefined) {
      const u = mix(p.seed, k);
      if (p.kind === 'const') v = p.v;
      else if (p.kind === 'run') { const blk = Math.floor(k / 8), r = mix(p.seed2, blk); v = p.duty ? (r < 0.06 ? 0 : 1) : (r < 0.05 ? 1 : 0); }
      else if (p.kind === 'meter') v = Math.max(0, p.start + (t - NOW0) / HOUR * p.rate);
      else if (p.kind === 'fill') { const pos = (((k + p.off) % p.period) + p.period) % p.period / p.period; const tri = pos < 0.7 ? pos / 0.7 : (1 - pos) / 0.3; v = p.lo + (p.hi - p.lo) * tri + (u - 0.5) * 1.5; }
      else if (p.kind === 'drain') { const x = ((((t - GRID0) / DAY + p.off) % p.days) + p.days) % p.days / p.days; v = p.top - (p.top - p.bottom) * x + (u - 0.5) * 0.8; }
      else if (p.kind === 'fn') v = p.fn(t, k, p);
      else v = p.base + p.amp * Math.sin(2 * Math.PI * (hourIST(t) - p.phase) / 24) + p.noise * (2 * u - 1);
    }
    if (p.kindOf === 'status') return v >= 0.5 ? 1 : 0;
    v = Math.min(p.valid[1], Math.max(p.valid[0], v));
    return round(v, p.dp);
  }
  function series(key, sensorId, from, to, stepMin) {
    const st = Math.max(1, Math.round(stepMin || 15)); const end = to != null ? to : now(); const start = from != null ? from : end - DAY; const out = [];
    if (!sensorRaw(key, sensorId) || String(sensorId).startsWith('m:')) return out;
    if (st % 15 === 0) { const n = st / 15; let k = Math.ceil((start - GRID0) / POLL); k = Math.ceil(k / n) * n; for (let t = pollAt(k); t <= end; t += n * POLL) out.push({ t, v: valueOf(key, sensorId, t) }); }
    else for (let t = start; t <= end; t += st * MIN) out.push({ t, v: valueOf(key, sensorId, t) });
    return out;
  }
  const latest = (key, sensorId) => { if (String(sensorId).startsWith('m:') || !sensorRaw(key, sensorId)) return null; const t = lastPollAtOrBefore(now()); return { t, v: valueOf(key, sensorId, t) }; };

  /* ── one firing = one would-be issue. The same tracker drives trial firings, the preview and live issues. ── */
  function termsOf(key, alertId, opts) {
    const a = alertRaw(key, alertId); if (!a) return null; const s = sensorRaw(key, a.sensor); const dir = alertDir(key, a); const o = opts || {};
    const bi = bandsInfo(key, a.sensor, dir);
    return { alertId, sensorId: a.sensor, dir, unit: s.unit, kind: s.kind, incl: s.kind === 'status', bands: o.limits ? norm4(o.limits) : { ...bi.bands }, hold: o.hold != null ? +o.hold : timingInfo(key, alertId, 'hold').value, clear: o.clear != null ? +o.clear : timingInfo(key, alertId, 'clear').value, gate: a.gate && a.gate.sensor ? { sensorId: a.gate.sensor, op: a.gate.op, value: a.gate.value } : null };
  }
  function crossed(terms, v) { for (let i = BANDS.length - 1; i >= 0; i--) { const b = BANDS[i], L = terms.bands[b]; if (L == null) continue; if (terms.dir === 'below' ? (terms.incl ? v <= L : v < L) : (terms.incl ? v >= L : v > L)) return b; } return null; }
  const newTracker = () => ({ phase: 'idle', firstPast: null, insideSince: null, f: null });
  const gateOn = (key, gate, t) => { if (!gate) return true; const g = sensorRaw(key, gate.sensorId); if (!g) return true; const v = valueOf(key, gate.sensorId, t); if (g.kind === 'status') return (gate.op === 'off') ? v < 0.5 : v >= 0.5; return gate.op === 'below' ? v < gate.value : v > gate.value; };
  function trackStep(tr, t, v, terms, open) {
    const sev = open ? crossed(terms, v) : null;
    if (tr.phase !== 'firing') {
      if (!sev) { tr.phase = 'idle'; tr.firstPast = null; return null; }
      if (tr.firstPast == null) tr.firstPast = t;
      if (sev === 'emergency' || t - tr.firstPast >= (terms.hold || 0) * MIN) { tr.phase = 'firing'; tr.insideSince = null; tr.f = { start: t, end: null, band: sev, firstBand: sev, peak: v, limit: terms.bands[sev], steps: [] }; return { type: 'start', f: tr.f, v }; }
      tr.phase = 'pending'; return null;
    }
    const f = tr.f;
    if (sev) {
      tr.insideSince = null; if (terms.dir === 'below' ? v < f.peak : v > f.peak) f.peak = v;
      if (RANK[sev] > RANK[f.band]) { f.band = sev; f.steps.push({ t, band: sev }); return { type: 'up', f, band: sev, v }; }
      return null;
    }
    if (tr.insideSince == null) tr.insideSince = t;
    if (t - tr.insideSince >= (terms.clear || 0) * MIN) { f.end = t; tr.phase = 'idle'; tr.firstPast = null; tr.insideSince = null; tr.f = null; return { type: 'end', f, v }; }
    return null;
  }
  const isShort = (f) => f.end != null && f.end - f.start <= 30 * MIN && !f.steps.length && f.limit != null && Math.abs(f.peak - f.limit) <= 0.1 * Math.abs(f.limit) + 1e-9;
  function replayTerms(key, terms, from, to) {
    const tr = newTracker(); const out = [];
    for (let t = firstPollAtOrAfter(from); t <= to; t += POLL) { const ev = trackStep(tr, t, valueOf(key, terms.sensorId, t), terms, gateOn(key, terms.gate, t)); if (ev && ev.type === 'start') out.push(ev.f); }
    const firings = out.map((f) => ({ start: f.start, end: f.end, band: f.band, firstBand: f.firstBand, peak: f.peak, limit: f.limit, short: isShort(f), steps: f.steps.slice(), minutes: f.end != null ? Math.round((f.end - f.start) / MIN) : null }));
    const days = Math.max(0, (to - from) / DAY); const sh = firings.filter((f) => f.short).length;
    return { firings, count: firings.length, perDay: firings.length / Math.max(days, 1), shortShare: firings.length ? sh / firings.length : 0, days, from, to };
  }
  function replay(key, alertId, opts) { const o = opts || {}; const terms = termsOf(key, alertId, o); if (!terms) return null; const to = o.to != null ? o.to : now(); const from = o.from != null ? o.from : to - 7 * DAY; return { ...replayTerms(key, terms, from, to), alertId, terms }; }
  function previewLimits(key, sensorId, dir, bands, opts) {
    const days = (opts && opts.days) || 7; const to = now(), from = to - days * DAY;
    const a = dOf(key).alerts.find((x) => x.sensor === sensorId && alertDir(key, x) === dir);
    const s = sensorRaw(key, sensorId); if (!s) return null;
    const base = a ? termsOf(key, a.id) : { alertId: null, sensorId, dir, unit: s.unit, kind: s.kind, incl: s.kind === 'status', bands: { ...bandsInfo(key, sensorId, dir).bands }, hold: hasAny(bands) && bands.emergency != null ? 0 : 5, clear: 10, gate: null };
    const withNew = replayTerms(key, { ...base, bands: norm4(bands) }, from, to); const cur = replayTerms(key, base, from, to);
    return { count: withNew.count, countNow: cur.count, days, alertId: a ? a.id : null, firings: withNew.firings, sample: true };
  }
  function trialStats(key, alertId) {
    const st = PS(key) && PS(key).alerts[alertId]; if (!st || st.trialSince == null) return null;
    return cached(`trial:${key}:${alertId}`, () => {
      const to = st.state === 'trial' ? now() : (st.trialEnd || now()); const r = replay(key, alertId, { from: st.trialSince, to });
      /* v7 (card D24): the records as they happened beside the replay with today's limits; noisy judges today's limits */
      const recs = (PS(key).trialLog || []).filter((x) => x.alertId === alertId && x.start >= st.trialSince && x.start <= to).map((x) => ({ ...x, steps: x.steps.slice(), minutes: x.end != null ? (x.end - x.start) / MIN : null }));
      const ended = recs.filter((x) => x.end != null); const days = r.days || Math.max(1 / 24, (to - st.trialSince) / DAY);
      const recorded = { count: recs.length, perDay: recs.length / days, shortShare: ended.length ? ended.filter((x) => x.short).length / ended.length : 0, firings: recs, days };
      return { ...r, since: st.trialSince, trialDays: r.days, noisy: r.perDay > 10, mostlyShort: r.count > 0 && r.shortShare >= 0.5, sample: true, recorded, todayCount: r.count, todayPerDay: r.perDay };
    });
  }
  function isNoisy(key, alertId) { const st = alertState(key, alertId); if (st === 'trial') { const ts = trialStats(key, alertId); return !!(ts && ts.noisy); } if (st === 'on') { const r = replay(key, alertId, { from: now() - 7 * DAY, to: now() }); return !!r && r.perDay > 10; } return false; }

  /* ── alert state ───────────────────────────────────────────────────────────────── */
  function alertState(key, alertId) {
    const st = PS(key) && PS(key).alerts[alertId]; if (st) return st.state;
    const a = alertRaw(key, alertId); if (!a) return null; if (a.status === 'draft') return 'draft'; if (a.status === 'off') return 'off';
    return PS(key) && PS(key).state === 'live' ? 'on' : 'trial';
  }
  function putAlertState(key, alertId, state, at) {
    const P = PS(key); const a = alertRaw(key, alertId); if (!a) return; const t = at != null ? at : now();
    const prev = P.alerts[alertId] || { state: alertState(key, alertId), since: null, trialSince: null };
    const st = { ...prev, state, since: t };
    if (state === 'trial') { st.trialSince = t; st.trialEnd = null; st.trialUntil = P.state === 'live' ? t + 7 * DAY : null; }
    if (prev.state === 'trial' && state !== 'trial') st.trialEnd = t;
    P.alerts[alertId] = st; a.status = state === 'draft' ? 'draft' : state === 'off' ? 'off' : 'active';
    P.eng[alertId] = newTracker(); touch();
  }
  const ALLOWED = { draft: ['trial', 'off'], trial: ['on', 'off'], on: ['off'], off: ['trial', 'on'] };
  function setAlertState(key, alertId, state, opts) {
    const a = alertRaw(key, alertId); if (!a) return { ok: false, error: 'No such alert.' };
    const cur = alertState(key, alertId); const P = PS(key); const live = P.state === 'live';
    if (cur === state) return { ok: true, state };
    if (!(ALLOWED[cur] || []).includes(state)) return { ok: false, error: `An alert that is ${LABELS.alertState[cur]} cannot go straight to ${LABELS.alertState[state]}.` };
    if (state === 'on' && !live) return { ok: false, error: 'Alerts go On when the plant goes live. Until then they run On trial.' };
    const s = sensorRaw(key, a.sensor); if (s && s.nextPhase) return { ok: false, error: `${s.name} is read on a connection: next phase.` };
    putAlertState(key, alertId, state);
    const e = alertEq(key, a); const fromLib = !!(e && s && libAlertFor(e.type, s.name, alertDir(key, a)));
    const ov = ovOnOff(key, { alertId });
    if (state === 'off' && fromLib && cur !== 'draft' && !ov) addOverride(key, { kind: 'onoff', alertId }, 'off', 'on', { reason: 'tuned', note: (opts && opts.note) || 'Turned off at this plant' });
    if (state !== 'off' && ov) endOverride(ov, 'Turned on again');
    addActivity(now(), key, `${a.name}: ${LABELS.alertState[cur]} → ${LABELS.alertState[state]}${opts && opts.note ? ` · ${opts.note}` : ''}`, 'config');
    touch(); persist(); return { ok: true, state };
  }

  /* ── views: plants, equipment, sensors, alerts, people ─────────────────────────────────────── */
  const plantView = (key) => { const d = dOf(key), P = PS(key); if (!d || !P) return null; return { key, name: d.plant.name, type: d.plant.type, state: P.state, stateLabel: LABELS.plantState[P.state], since: P.since, sample: !!P.sample, realLayout: !!P.realLayout }; };
  const plants = () => ORDER.filter((k) => PS(k) && dOf(k)).map(plantView);
  function plant(key) {
    const v = plantView(key); if (!v) return null; const d = dOf(key);
    return { ...v, equipmentCount: d.equipment.length, sensorCount: d.sensors.length, alertCount: d.alerts.filter((a) => ['trial', 'on'].includes(alertState(key, a.id))).length, openIssues: PS(key).issues.filter((i) => i.status !== 'closed').length, differences: S.overrides.filter((o) => o.plant === key && !o.endedAt).length, capacity: d.plant.capacity };
  }
  const state = (key) => (PS(key) ? PS(key).state : null);
  /* v7: when this plant's trial started: the earliest alert now On trial (null when none is) */
  const trialStart = (key) => { const P = PS(key); if (!P) return null; const xs = Object.values(P.alerts).filter((x) => x.state === 'trial' && x.trialSince != null).map((x) => x.trialSince); return xs.length ? Math.min(...xs) : null; };
  /* v7: Running / Stopped only from a Run status reading's latest sample; null when the equipment has no such reading */
  function runStateOf(key, e) { const rs = dOf(key).sensors.find((s) => s.on === 'eq:' + e.id && s.kind === 'status' && s.name === 'Run status' && !s.nextPhase); if (!rs) return null; const l = latest(key, rs.id); return l ? (l.v >= 0.5 ? 'running' : 'stopped') : null; }
  function eqView(key, e) {
    const cat = catByType(e.type); const ti = tierInfo(key, e.id);
    return { id: e.id, tag: e.tag, name: e.name, typeName: e.type, type: e.type, code: e.code, dbType: e.dbType || e.code, drawn: C.dbName(e.code), stored: e.type, typeDiffers: !!e.code && !!e.dbType && e.code !== e.dbType && !e.offer && !e.subtype, offer: e.offer || null, subtype: e.subtype || null, notInDb: !!e.notInDb, archetype: e.archetype, tier: ti ? ti.value : e.tier, tierLabel: C.TIER_LABEL[ti ? ti.value : e.tier], tierSource: ti, status: e.status, running: runStateOf(key, e) === 'running', runState: runStateOf(key, e), inLibrary: !!cat, form: e.form || null, sensorIds: dOf(key).sensors.filter((s) => s.on === 'eq:' + e.id).map((s) => s.id) };
  }
  const equipment = (key) => cached(`eqs:${key}`, () => (dOf(key) ? dOf(key).equipment.map((e) => eqView(key, e)) : []));
  const eq = (key, id) => { const e = eqRaw(key, id); return e ? eqView(key, e) : null; };
  function sensorView(key, s) {
    const e = homeOf(key, s); let dirs = s.kind === 'meter' ? [] : dirsOf(key, s.id); if (s.kind === 'status' && !dirs.some((dr) => hasAny(bandsInfo(key, s.id, dr).bands))) dirs = []; const np = s.nextPhase ? withPlant(key, () => (C.nextPhaseOf(e) || []).find((x) => x.sensor === s.id)) : null;
    return { id: s.id, name: s.name, tag: s.tag, unit: s.unit, kind: s.kind, valid: s.valid.slice(), eqId: e ? e.id : null, eqTag: e ? e.tag : null, nextPhase: !!s.nextPhase, nextPhaseNote: s.nextPhase ? ((np && np.note) || 'on a connection: next phase') : null, dirs, primaryDir: s.nextPhase || !dirs.length ? null : primaryDir(key, s.id), takesLimits: !s.nextPhase && s.kind !== 'meter', alertIds: dOf(key).alerts.filter((a) => a.sensor === s.id).map((a) => a.id), source: 'Visualization', latest: latest(key, s.id), sample: true };
  }
  const sensors = (key, eqId) => cached(`sens:${key}:${eqId || ''}`, () => (dOf(key) ? dOf(key).sensors.filter((s) => !eqId || s.on === 'eq:' + eqId).map((s) => sensorView(key, s)) : []));
  function readings(key, opts) {
    const eqId = opts && opts.eqId; const out = sensors(key, eqId).slice();
    /* v7: only a test that records a number is a reading; a visual check (its steps hold no reading, e.g. "Biofilm visual check") is a task only */
    const measured = (sc) => { const gt = sc.task ? C.taskById(sc.task) : sc.flow ? C.taskByFlow(sc.flow) : null; const fid = sc.flow || (gt && gt.flow); const f = fid ? C.flow(fid) || libFlow(fid) : null; return !f || !(f.steps || []).length || f.steps.some((x) => x.type === 'reading'); };
    dOf(key).schedules.filter((sc) => sc.workType === 'test' && sc.status === 'active' && !subDaily(sc) && (!eqId || (sc.subject && sc.subject.id === eqId)) && measured(sc)).forEach((sc) => {
      const e = sc.subject.kind === 'eq' ? eqRaw(key, sc.subject.id) : null; const name = sc.name.replace(/^Manual testing\s*-\s*/i, '');
      out.push({ id: `m:${sc.id}`, name, tag: null, unit: '', kind: 'manual', eqId: e ? e.id : null, eqTag: e ? e.tag : null, nextPhase: false, dirs: dirsOf(key, `m:${sc.id}`), primaryDir: dirsOf(key, `m:${sc.id}`)[0], takesLimits: true, latest: null, sample: false, source: /\b(BOD|COD|TSS|ammonia|lab|test|sample)\b/i.test(sc.name) ? 'lab' : 'manual', expected: everyText(C.cadenceOf(sc)), scheduleId: sc.id });
    });
    return out;
  }
  /* v7: the one "No limits yet" test: a reading on equipment that takes limits (not a counter, not an ON/OFF status, not next phase) and has none */
  function noLimitsYet(key, r) {
    if (!r || r.nextPhase || !r.eqId || r.kind === 'meter' || r.kind === 'status' || r.takesLimits === false) return false;
    return !['above', 'below'].some((dir) => { const bi = bandsInfo(key, r.id, dir); return bi && hasAny(bi.bands); });
  }
  function alertView(key, a) {
    const s = sensorRaw(key, a.sensor) || {}; const e = alertEq(key, a); const dir = alertDir(key, a); const st = alertState(key, a.id); const P = PS(key); const rec = P.alerts[a.id] || {};
    const bi = bandsInfo(key, a.sensor, dir) || { bands: norm4(null) }; const flow = diagOfAlert(key, a);
    const open = P.issues.find((i) => i.alertId === a.id && i.status !== 'closed');
    return { id: a.id, name: a.name, eqId: e ? e.id : null, eqTag: e ? e.tag : null, sensorId: a.sensor, sensorName: s.name, sensorTag: s.tag, unit: s.unit, kind: s.kind, dir, dirWord: dirWord(dir), state: st, stateLabel: LABELS.alertState[st], since: rec.since || null, trialSince: rec.trialSince || null, trialUntil: rec.trialUntil || null, bands: { ...bi.bands }, entryBand: BANDS.find((b) => bi.bands[b] != null) || null, hold: timingInfo(key, a.id, 'hold'), clear: timingInfo(key, a.id, 'clear'), emergencyFirst: true, flowId: flow ? flow.id : null, flowName: flow ? flow.name : null, issueTypeId: withPlant(key, () => C.alertIssue(a)) || null, fromLibrary: !!(e && libAlertFor(e.type, s.name, dir)), openIssueId: open ? open.id : null, gated: !!a.gate, clockText: 'Start by / fix by follow the severity', nextPhase: !!s.nextPhase };
  }
  function alerts(key, opts) {
    const o = opts || {}; const all = cached(`alerts:${key}`, () => (dOf(key) ? dOf(key).alerts.map((a) => alertView(key, a)) : []));
    return all.filter((a) => (!o.eqId || a.eqId === o.eqId) && (!o.sensorId || a.sensorId === o.sensorId) && (!o.state || a.state === o.state));
  }
  const alert = (key, id) => alerts(key).find((a) => a.id === id) || null;
  function schedules(key, opts) {
    const eqId = opts && opts.eqId; const d = dOf(key); if (!d) return [];
    return d.schedules.filter((sc) => !subDaily(sc) && (!eqId || (sc.subject && sc.subject.id === eqId))).map((sc) => { const e = sc.subject.kind === 'eq' ? eqRaw(key, sc.subject.id) : null; const tv = taskIdOfSchedule(key, sc.id); return { id: sc.id, name: sc.name, eqId: e ? e.id : null, eqTag: e ? e.tag : null, workType: sc.workType, workLabel: C.WT_LABEL[sc.workType] || sc.workType, every: C.cadenceOf(sc), everyText: C.every(sc), basis: sc.basis, status: sc.status, source: cadenceInfo(key, sc.id), taskId: tv, generalTaskId: sc.task || null, flowId: sc.flow || null }; });
  }
  const ROLE = C.ROLE_LABEL || { l1: 'Operator', l3: 'Lead', l4: 'Senior Lead', regular: 'Client viewer' };
  const channelOf = (p) => (!p.phone || !p.phone.verified ? 'in the app' : p.phone.channel === 'wa' ? 'WhatsApp' : p.phone.channel === 'sms' ? 'SMS' : 'in the app');
  /* v7/4: people are kept in the User Center, which this prototype does not have. So that a plant being set up can be walked
     all the way to go live, this stands in for it: one Operator and one Lead with verified phones. */
  function addSamplePeople(key) {
    const d = dOf(key); if (!d) return { ok: false, error: 'No such plant.' }; d.people = d.people || [];
    const has = (roles) => d.people.some((p) => roles.includes(p.role) && p.phone && p.phone.verified); let n = 0;
    if (!has(['l1'])) { d.people.push({ id: 'sp_op', name: 'Sample Operator', role: 'l1', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '22:00–06:00', sample: true }); n++; }
    if (!has(['l3', 'l4'])) { d.people.push({ id: 'sp_lead', name: 'Sample Lead', role: 'l3', grant: 'people', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '22:00–06:00', sample: true }); n++; }
    if (n) log(key, `Sample people added to stand in for the User Center: ${n === 2 ? 'an Operator and a Lead' : 'one person'} with a verified phone`, 'config');
    touch(); persist(); return { ok: true, count: n };
  }
  const people = (key) => (dOf(key) ? dOf(key).people.map((p) => ({ id: p.id, name: p.name, role: p.role, roleLabel: ROLE[p.role] || p.role, grant: p.grant || null, phone: p.phone, channel: channelOf(p), reachable: !!(p.phone && p.phone.verified), quiet: p.quiet })) : []);
  const reachable = (key, role) => people(key).filter((p) => p.role === role && p.reachable);

  /* ── activity ──────────────────────────────────────────────────────────────────────────────── */
  function addActivity(at, plantKey, text, kind, who) { S.aseq = (S.aseq || 0) + 1; S.activity.push({ seq: S.aseq, at, plant: plantKey || null, who: who === undefined ? ME : who == null ? 'Automatic' : who, text, kind: kind || 'config' }); }
  function activity(opts) {
    const o = opts || {}; const list = S.activity.filter((x) => (!o.plant || x.plant === o.plant) && (!o.kind || x.kind === o.kind)).slice().sort((a, b) => b.at - a.at || b.seq - a.seq);
    return (o.limit ? list.slice(0, o.limit) : list).map((x) => ({ at: x.at, plant: x.plant, plantName: x.plant ? plantName(x.plant) : 'All plants', who: x.who, text: x.text, kind: x.kind }));
  }
  function log(plantKey, text, kind) { addActivity(now(), plantKey, text, kind); touch(); persist(); }

  /* ── issues: who is told, opening, the engine ──────────────────────────────────────────────── */
  function tellList(key, band, commissioning, at) {
    const ppl = dOf(key).people; const by = (r) => ppl.filter((p) => p.role === r); const out = []; const add = (p, how) => out.push({ who: p.name, role: ROLE[p.role] || p.role, how, at });
    if (commissioning) { [...by('l3'), ...by('l4')].forEach((p) => { if (p.phone && p.phone.verified) add(p, channelOf(p)); add(p, 'in the app'); }); return out; }
    if (band === 'emergency') { [...by('l1'), ...by('l3'), ...by('l4')].forEach((p) => { add(p, 'phone call'); add(p, 'full-screen alarm'); }); out.push({ who: 'Plant hooter', role: '', how: 'hooter', at }); return out; }
    if (band === 'major') { [...by('l1'), ...by('l3')].forEach((p) => { add(p, channelOf(p)); add(p, 'full-screen alarm'); }); return out; }
    if (band === 'minor') { by('l1').forEach((p) => add(p, channelOf(p))); by('l3').forEach((p) => add(p, 'in the app')); return out; }
    [...by('l1'), ...by('l3')].forEach((p) => { add(p, 'in the app'); add(p, 'morning email'); }); return out;
  }
  /* v7: the "who was told" line is built from the told list itself (never a fixed sentence per band) */
  const HOW_ORDER = ['phone call', 'WhatsApp', 'SMS', 'full-screen alarm', 'in the app', 'morning email', 'hooter'];
  const joinAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  function toldText(iss) {
    const told = iss.told || [];
    if (!told.length) return iss.commissioning || iss.band === 'emergency' || iss.band === 'major' ? 'Nobody could be told: no Lead in the User Center' : 'Nobody could be told: nobody in the User Center';
    const hows = [...new Set(told.map((x) => x.how))].sort((a, b) => HOW_ORDER.indexOf(a) - HOW_ORDER.indexOf(b));
    const parts = hows.filter((h) => h !== 'hooter').map((h) => {
      const names = [...new Set(told.filter((x) => x.how === h).map((x) => x.who))]; const who = names.length <= 3 ? joinAnd(names) : `${names.length} people`;
      return h === 'phone call' ? `called ${who}` : h === 'full-screen alarm' ? `the alarm for ${who}` : h === 'in the app' ? `${who} in the app` : h === 'morning email' ? `${who} in the morning email` : `${who} by ${h}`;
    });
    if (hows.includes('hooter')) parts.push('the plant hooter');
    return `Told ${parts.join('; ')}${iss.commissioning ? '; no call, no hooter' : ''}`;
  }
  const ilog = (iss, at, text) => iss.log.push({ at, text });
  function openAlertIssue(key, a, f, terms, at, opts) {
    const P = PS(key); const s = sensorRaw(key, a.sensor); const e = alertEq(key, a); const commissioning = P.state === 'commissioning';
    const flow = diagOfAlert(key, a);
    const iss = { id: nextId('is'), plant: key, alertId: a.id, issueTypeId: withPlant(key, () => C.alertIssue(a)) || null, title: a.name, eqId: e ? e.id : null, sensorId: a.sensor, band: f.band, peak: f.peak, opened: at, closed: null, cleared: null, status: 'open', terms: { limit: terms.bands[f.band], band: f.band, hold: terms.hold, clear: terms.clear, dir: terms.dir, unit: terms.unit, bands: { ...terms.bands } }, commissioning, told: [], diag: { flowId: flow ? flow.id : null, path: [], causeId: null }, fix: { flowId: null, done: [] }, causedBy: null, falseAlarm: false, closedHow: null, short: null, log: [] };
    iss.told = tellList(key, f.band, commissioning, at);
    const v = fmtVal(f.peak, s.unit, s.kind), lim = fmtVal(terms.bands[f.band], s.unit, s.kind);
    ilog(iss, at, `Opened at ${BAND_LABEL[f.band]}${commissioning ? ' during the Commissioning trial' : ''}: ${said(s, f.peak)} (${dirWord(terms.dir)} ${lim}, must hold for ${f.band === 'emergency' ? '0' : terms.hold} min)`);
    ilog(iss, at, `${toldText(iss)}.`);
    P.issues.unshift(iss);
    if (!(opts && opts.quiet)) addActivity(at, key, `Issue opened${commissioning ? ' (Commissioning)' : ''}: ${a.name} at ${BAND_LABEL[f.band]} — ${said(s, f.peak)}`, 'issue', null);
    return iss;
  }
  function closeIssue(key, iss, at, how, text, opts) {
    iss.status = 'closed'; iss.closed = at; iss.closedHow = how; ilog(iss, at, text);
    if (!(opts && opts.quiet)) addActivity(at, key, `Issue closed: ${iss.title}${how === 'false alarm' ? ' (false alarm)' : how === 'reading' ? ' (the reading came back)' : ''}`, 'issue', how === 'reading' ? null : ME);
  }
  /* ── condition-based work: a task a line on an equipment alert raises, filed at the plant ──────────────────────────── */
  const lineWorkOf = (key) => { const P = PS(key); return P ? (P.lineWork || (P.lineWork = [])) : []; };
  const lineWorkOn = (key, sensorId, dir) => lineWorkOf(key).filter((lw) => lw.sensorId === sensorId && lw.dir === dir);
  const isTaskLine = (key, sensorId, dir, band) => lineWorkOn(key, sensorId, dir).some((lw) => lw.band === band);
  /* raised once; it is raised again only after someone completes it */
  function raiseLineWork(key, lw, t, v, out, quiet) {
    const P = PS(key); const st = P.tasks[lw.id];
    if (st && (st.status === 'due' || st.status === 'doing')) return;
    const s = sensorRaw(key, lw.sensorId); const e = s ? homeOf(key, s) : null;
    P.tasks[lw.id] = { due: t, lastDone: st ? st.lastDone : null, status: 'due', done: [], history: st ? st.history || [] : [], startedAt: null, raisedAt: t, raisedBy: { band: lw.band, value: v } };
    if (!quiet) addActivity(t, key, `Task raised: ${lw.name}, ${e ? e.tag + ' ' : ''}${s ? said(s, v) : ''} (${BAND_LABEL[lw.band]} line)`, 'task', null);
    if (out && out.tasksDue) out.tasksDue.push({ plant: key, id: lw.id, name: lw.name, due: t });
  }
  /* the line's words: "When BL-1 Motor current rises above 44 A (Caution)" — the limit is read live, so moving the line moves the task */
  function lineWorkView(key, lw) {
    const s = sensorRaw(key, lw.sensorId); const e = s ? homeOf(key, s) : null; const lim = bandsInfo(key, lw.sensorId, lw.dir);
    const at = lim && lim.bands ? lim.bands[lw.band] : null;
    const alert = dOf(key).alerts.find((a) => a.sensor === lw.sensorId && alertDir(key, a) === lw.dir) || null;
    /* v7/3: what a reading triggers sits on that reading's equipment, task and issue alike */
    const filed = e ? { kind: 'eq', id: e.id, tag: e.tag, text: e.tag } : { kind: 'plant', id: '', tag: '', text: 'the plant' };
    return { filed, id: lw.id, name: lw.name, why: lw.why || '', sensorId: lw.sensorId, dir: lw.dir, band: lw.band, bandLabel: BAND_LABEL[lw.band], limit: at, limitText: at == null ? '' : fmtVal(at, s ? s.unit : '', s ? s.kind : ''), eqId: e ? e.id : null, eqTag: e ? e.tag : '', reading: s ? s.name : '', unit: s ? s.unit || '' : '', kind: s ? s.kind || '' : '', alertId: alert ? alert.id : null, alertName: alert ? alert.name : '', flowId: lw.flowId || null, flowName: lw.flowId && libFlow(lw.flowId) ? libFlow(lw.flowId).name : '',
      whenText: `When ${e ? e.tag + ' ' : ''}${s ? s.name : 'the reading'} ${lw.dir === 'below' ? 'falls below' : 'rises above'} ${at == null ? 'its line' : fmtVal(at, s ? s.unit : '', s ? s.kind : '')} (${BAND_LABEL[lw.band]})`, at: lw.at || null, by: lw.by || null };
  }
  function lineWork(key, opts) { const o = opts || {}; return lineWorkOf(key).filter((lw) => (!o.sensorId || lw.sensorId === o.sensorId) && (!o.dir || lw.dir === o.dir) && (!o.eqId || lineWorkView(key, lw).eqId === o.eqId)).map((lw) => lineWorkView(key, lw)); }
  /* set (or with name null, remove) the task a line raises. One task per line; the line must be set on that reading. */
  function setLineWork(key, sensorId, dir, band, opts) {
    const P = PS(key); if (!P) return { ok: false, error: 'No such plant.' }; if (!BANDS.includes(band)) return { ok: false, error: 'Pick a line.' };
    const s = sensorRaw(key, sensorId); if (!s) return { ok: false, error: 'No such reading.' }; const e = homeOf(key, s);
    const list = lineWorkOf(key); const i = list.findIndex((lw) => lw.sensorId === sensorId && lw.dir === dir && lw.band === band);
    const name = opts && opts.name != null ? String(opts.name).trim() : null;
    const filedAt = opts && opts.filedAt !== undefined ? (opts.filedAt || null) : (i >= 0 ? list[i].filedAt || null : null);
    const whereText = e ? e.tag : 'the plant';
    if (name == null || name === '') {
      if (i < 0) return { ok: true, changed: false };
      const was = list[i]; list.splice(i, 1); const st = P.tasks[was.id]; if (st && st.status !== 'doing') delete P.tasks[was.id];
      addActivity(now(), key, `The ${BAND_LABEL[band]} line on ${e ? e.tag + ' ' : ''}${s.name} no longer raises "${was.name}"; it opens an issue again`, 'config');
      touch(); persist(); return { ok: true, changed: true };
    }
    const lim = bandsInfo(key, sensorId, dir); if (!lim || !lim.bands || lim.bands[band] == null) return { ok: false, error: `${s.name} has no ${BAND_LABEL[band]} line ${dir === 'below' ? 'below' : 'above'}. Set the line first.` };
    const flowId = opts && opts.flowId !== undefined ? (opts.flowId || null) : (i >= 0 ? list[i].flowId || null : null);
    if (i >= 0) { if (list[i].name === name && (list[i].filedAt || null) === filedAt && (list[i].flowId || null) === flowId) return { ok: true, changed: false }; list[i].flowId = flowId; const old = list[i].name; list[i].name = name; list[i].filedAt = filedAt; if (opts.why != null) list[i].why = String(opts.why); addActivity(now(), key, `Renamed the task the ${BAND_LABEL[band]} line on ${e ? e.tag + ' ' : ''}${s.name} raises: "${old}" → "${name}"`, 'config'); touch(); persist(); return { ok: true, changed: true, id: list[i].id }; }
    const lw = { id: nextId('lw'), name, sensorId, dir, band, filedAt, flowId, why: opts && opts.why ? String(opts.why) : '', at: now(), by: ME };
    list.push(lw); if (P.state === 'live') P.tasks[lw.id] = { due: null, lastDone: null, status: 'armed', done: [], history: [], startedAt: null };
    addActivity(now(), key, `The ${BAND_LABEL[band]} line on ${e ? e.tag + ' ' : ''}${s.name} now triggers the task "${name}" on ${whereText} instead of an issue`, 'config');
    touch(); persist(); return { ok: true, changed: true, id: lw.id };
  }
  const wasLive = (P) => P.goLiveAt != null || (P.returned || []).length > 0;
  const furthest = (dir, a, b) => (a == null ? b : b == null ? a : dir === 'below' ? Math.min(a, b) : Math.max(a, b));
  /* run the engine from the plant's last poll to toT. Live alerts open issues; trial alerts record firings and open a real issue only at Emergency. */
  function runEngine(key, toT, out, opts) {
    const P = PS(key); const d = dOf(key); const quiet = !!(opts && opts.quiet);
    const fromT = P.engineAt != null ? P.engineAt : toT;
    if (toT <= fromT) return;
    d.alerts.forEach((a) => {
      const st = alertState(key, a.id); if (st !== 'trial' && st !== 'on') return;
      const s = sensorRaw(key, a.sensor); if (!s || s.nextPhase) return;
      const tr = P.eng[a.id] || (P.eng[a.id] = newTracker());
      const cur = termsOf(key, a.id); if (!cur) return;
      let open = P.issues.find((i) => i.alertId === a.id && i.status !== 'closed') || null;
      /* v7 (card D24): a firing on trial is kept as it happened, with the limit it crossed; tuning later never rewrites it */
      if (!P.trialLog) P.trialLog = [];
      let trec = st === 'trial' ? P.trialLog.find((r) => r.alertId === a.id && r.end == null) || null : null;
      for (let t = firstPollAfter(fromT); t <= toT; t += POLL) {
        const terms = open ? { ...cur, bands: open.terms.bands, hold: open.terms.hold, clear: open.terms.clear, dir: open.terms.dir } : cur;
        const v = valueOf(key, a.sensor, t); const ev = trackStep(tr, t, v, terms, gateOn(key, terms.gate, t));
        /* v7: an open issue's Lowest/Highest is the furthest reading so far, kept on every poll while it is open (never the value at
           opening, never a later, milder firing's) */
        if (open && tr.f) open.peak = furthest(open.terms.dir, open.peak, tr.f.peak);
        if (trec && tr.f) trec.peak = furthest(terms.dir, trec.peak, tr.f.peak);
        if (ev && st === 'trial') {
          if (ev.type === 'start') { trec = { alertId: a.id, start: t, end: null, band: ev.f.band, firstBand: ev.f.band, peak: ev.f.peak, limit: terms.bands[ev.f.band], steps: [], short: false }; P.trialLog.push(trec); }
          else if (ev.type === 'up' && trec) { trec.band = ev.band; trec.steps.push({ t, band: ev.band }); }
          else if (ev.type === 'end' && trec) { trec.end = t; trec.peak = furthest(terms.dir, trec.peak, ev.f.peak); trec.short = isShort(trec); trec = null; }
        }
        if (!ev) continue;
        /* v7: a line that creates a task raises it (Live plant, alert On) and opens no issue; a deeper line opens the issue as before */
        const band = ev.type === 'start' ? ev.f.band : ev.type === 'up' ? ev.band : null;
        if (band && st === 'on' && P.state === 'live') {
          lineWorkOn(key, a.sensor, terms.dir).filter((lw) => RANK[lw.band] <= RANK[band]).forEach((lw) => raiseLineWork(key, lw, t, v, out, quiet));
          if (!open && isTaskLine(key, a.sensor, terms.dir, band)) { nextId('is'); continue; }   /* the firing keeps its number, so the story's later ids stay as they were */
          if (!open && ev.type === 'up' && band !== 'emergency' && isTaskLine(key, a.sensor, terms.dir, ev.f.firstBand)) { open = openAlertIssue(key, a, { ...ev.f, band }, terms, t, { quiet }); if (out) out.opened.push({ id: open.id, plant: key, title: open.title, band, opened: t }); continue; }
        }
        if (ev.type === 'start') {
          if (st === 'trial' && out) out.trial.push({ plant: key, alertId: a.id, name: a.name, start: t, band: ev.f.band });
          /* v7: a new firing deeper than the open issue's band is a step up (rule 10: it escalates by its own terms; Emergency calls) */
          if (open && RANK[ev.f.band] > RANK[open.band]) { open.band = ev.f.band; open.peak = furthest(open.terms.dir, open.peak, ev.f.peak); open.cleared = null; ilog(open, t, `Stepped up to ${BAND_LABEL[ev.f.band]}: ${said(s, v)}`); (tellList(key, ev.f.band, open.commissioning, t)).forEach((x) => open.told.push(x)); continue; }
          if (open) { open.peak = furthest(open.terms.dir, open.peak, ev.f.peak); open.cleared = null; ilog(open, t, `Fired again: ${said(s, v)} (${BAND_LABEL[ev.f.band]})`); continue; }
          if (st === 'on' || (ev.f.band === 'emergency' && wasLive(P))) { open = openAlertIssue(key, a, ev.f, terms, t, { quiet }); if (out) out.opened.push({ id: open.id, plant: key, title: open.title, band: open.band, opened: t }); }
        } else if (ev.type === 'up') {
          if (open) { open.band = ev.band; open.peak = furthest(open.terms.dir, open.peak, ev.f.peak); ilog(open, t, `Stepped up to ${BAND_LABEL[ev.band]}: ${said(s, v)}`); (tellList(key, ev.band, open.commissioning, t)).forEach((x) => open.told.push(x)); }
          else if (ev.band === 'emergency' && wasLive(P)) { open = openAlertIssue(key, a, { ...ev.f, band: 'emergency' }, terms, t, { quiet }); if (out) out.opened.push({ id: open.id, plant: key, title: open.title, band: 'emergency', opened: t }); }
        } else if (ev.type === 'end') {
          if (!open) continue;
          open.cleared = t; open.peak = furthest(open.terms.dir, open.peak, ev.f.peak); open.short = isShort(ev.f);
          if (open.status === 'open' && open.band !== 'emergency') { closeIssue(key, open, t, 'reading', `Closed by the reading: back inside the limits for ${terms.clear} min, and nobody had started it`, { quiet }); if (out) out.closed.push({ id: open.id, plant: key, title: open.title, closed: t }); open = null; }
          else ilog(open, t, `Back inside the limits for ${terms.clear} min (${said(s, v)})`);
        }
      }
    });
    P.engineAt = lastPollAtOrBefore(toT);
  }

  /* ── tasks (schedules, and set-level groups: rule 11) ─────────────────────────────────────── */
  /* v7: run-hours (rule 12). The hour meter counts only while the equipment runs (duty about 20 run-hours a day, standby about 1), so
     run-hours work falls due when the meter reaches the reading at its last service (or at go live) plus its run-hours; "either" takes
     the earlier of that and the calendar date. Such work is left out of the go-live spread. */
  const rateOfEq = (e) => ((e && e.status === 'stopped') ? STANDBY_RUN_HOURS_PER_DAY : RUN_HOURS_PER_DAY) / 24;   // run-hours per clock hour
  function intervalH(sc, rate) {
    const cal = sc.every && sc.every.n ? sc.every.n * (C.UNIT_HOURS[sc.every.unit] || 24) : null; const mh = sc.meter ? sc.meter.hours : sc.meterHours; const met = mh ? mh / (rate || RUN_HOURS_PER_DAY / 24) : null;
    if (sc.basis === 'meter' && met) return met; if (sc.basis === 'either') return Math.min(cal || Infinity, met || Infinity); return cal || met || 24 * 30;
  }
  const meterProfile = (key, sc) => { if (!sc || !sc.meter || !sc.meter.tag || !(sc.basis === 'meter' || sc.basis === 'either')) return null; const p = sensorRaw(key, sc.meter.tag) ? profileOf(key, sc.meter.tag) : null; return p && p.kind === 'meter' && p.rate > 0 ? p : null; };
  const meterAtT = (p, t) => p.start + (t - NOW0) / HOUR * p.rate;
  const meterTimeOf = (p, reading) => NOW0 + (reading - p.start) / p.rate * HOUR;
  /* the due time of run-hours work from its task state (lastDone) and the plant's go live; null when it is not run-hours work */
  function meterDue(key, sc, st) {
    const p = meterProfile(key, sc); if (!p) return null; const P = PS(key);
    const base = st && st.lastDone != null ? meterAtT(p, st.lastDone) : Math.max(typeof sc.meter.last === 'number' ? sc.meter.last : -Infinity, P.goLiveAt != null ? meterAtT(p, P.goLiveAt) : -Infinity, P.goLiveAt == null ? meterAtT(p, now()) : -Infinity);
    let due = firstPollAtOrAfter(meterTimeOf(p, base + sc.meter.hours));
    if (sc.basis === 'either' && sc.every && sc.every.n) { const calI = sc.every.n * (C.UNIT_HOURS[sc.every.unit] || 24) * HOUR; const cal = st && st.lastDone != null ? st.lastDone + calI : st && st.calDue != null ? st.calDue : (P.goLiveAt != null ? P.goLiveAt : now()) + calI; due = Math.min(due, cal); }   /* v7: calDue = the calendar date a change of interval set for work never done (dueAfterChange) */
    return Math.round(due / MIN) * MIN;
  }
  /* run-hours left before it falls due (for the task page) */
  function meterLeft(key, sc, st) { const p = meterProfile(key, sc); if (!p) return null; const P = PS(key); const base = st && st.lastDone != null ? meterAtT(p, st.lastDone) : Math.max(typeof sc.meter.last === 'number' ? sc.meter.last : -Infinity, P.goLiveAt != null ? meterAtT(p, P.goLiveAt) : meterAtT(p, now())); return { now: round(meterAtT(p, now()), 1), at: round(base + sc.meter.hours, 1), left: round(base + sc.meter.hours - meterAtT(p, now()), 1), rateDay: round(p.rate * 24, 1) }; }
  const spreadFrac = (id) => mix(h32(id), 99);
  /* v7/4: the work level. One choice for the plant says how much routine work it takes on, instead of switching tasks off one by one.
     A task's level comes from what it is and how often it is done, so it needs no setting of its own:
       1 preventive maintenance, calibration and statutory work · 2 weekly or slower · 3 daily (everything).
     What a lower level can never do: touch an alert, or work a reading raises, or level-1 work. And while keepUnwatched is on
     (the default), routine work stays wherever an alert does not watch every piece of equipment it is done on. */
  /* v7/4: no routine task comes round more often than once a day. Work on a calendar interval under 24 hours is left out everywhere:
     it is not proposed, not listed on a library type, and not built into a task even where a plant had accepted it before. Work a
     reading raises is not affected (it has no interval), and neither is work counted in run-hours. */
  const everyH = (ev) => (ev && ev.n ? ev.n * (C.UNIT_HOURS[ev.unit] || 24) : null);
  const subDaily = (sc) => !!sc && sc.workType !== 'condition' && !sc.meter && !sc.meterHours && everyH(sc.every) != null && everyH(sc.every) < 24;
  const WORK_LEVELS = [
    { level: 1, label: 'Essentials', what: 'Preventive maintenance, calibration and statutory work' },
    { level: 2, label: 'Weekly and slower', what: 'Essentials, plus anything done weekly or less often' },
    { level: 3, label: 'Everything', what: 'Every task the library has. Nothing is done more often than once a day' },
  ];
  const levelOfTask = (v) => (v.kind === 'line' ? 0 : v.workType === 'pm' || v.workType === 'calibration' || v.statutory ? 1 : v.intervalH >= 168 ? 2 : 3);
  function levelCut(key, level, keep) {
    const d = dOf(key); const watched = new Set();
    d.alerts.forEach((a) => { const st = alertState(key, a.id); if ((st === 'trial' || st === 'on') && a.subject && a.subject.kind === 'eq') watched.add(a.subject.id); });
    return buildAllTasks(key).map((v) => { const lv = levelOfTask(v); const w = v.eqIds.length > 0 && v.eqIds.every((id) => watched.has(id)); return { v, lv, watched: w, out: lv > level && !(keep && !w) }; });
  }
  function buildTasks(key) {
    return cached(`tasks:${key}`, () => { const P = PS(key); const L = Math.min((P && P.workLevel) || 3, 3); return L >= 3 ? buildAllTasks(key) : levelCut(key, L, P.keepUnwatched !== false).filter((x) => !x.out).map((x) => x.v); });
  }
  function workLevel(key) {
    const P = PS(key); if (!P || !dOf(key)) return null; const level = Math.min(P.workLevel || 3, 3); const keep = P.keepUnwatched !== false;
    const row = (x) => ({ id: x.v.id, line: x.v.line, everyText: x.v.everyText, workLabel: x.v.workLabel, watched: x.watched });
    const options = WORK_LEVELS.map((o) => { const c = levelCut(key, o.level, keep); const inn = c.filter((x) => !x.out); const perDay = inn.reduce((n, x) => n + x.v.perDay, 0); return { ...o, on: o.level === level, tasks: inn.length, leftOut: c.length - inn.length, perDay, perMonth: Math.round(perDay * 30) }; });
    const cut = levelCut(key, level, keep);
    return { level, label: WORK_LEVELS[level - 1].label, keepUnwatched: keep, options, total: cut.length, leftOut: cut.filter((x) => x.out).map(row), kept: cut.filter((x) => x.lv > level && !x.out).map(row), unwatchedIfNotKept: levelCut(key, level, false).filter((x) => x.out && !x.watched).length };
  }
  function setWorkLevel(key, level, opts) {
    const P = PS(key); const L = Number(level); if (!P || !dOf(key)) return { ok: false, error: 'No such plant.' }; if (![1, 2, 3].includes(L)) return { ok: false, error: 'No such level.' };
    P.workLevel = L; if (opts && opts.keepUnwatched != null) P.keepUnwatched = !!opts.keepUnwatched; touch(); ensureTaskStates(key);
    const w = workLevel(key); const on = w.options[L - 1];
    addActivity(now(), key, `Work level set to ${w.label}: ${Math.round(on.perDay)} tasks a day${w.leftOut.length ? `, ${plural(w.leftOut.length, 'task')} left out` : ', nothing left out'}${L < 3 ? (w.keepUnwatched ? '; routine work stays where no alert watches the equipment' : '; routine work is left out even where no alert watches the equipment') : ''}`, 'config');
    touch(); persist(); return { ok: true, level: L, leftOut: w.leftOut.length, kept: w.kept.length };
  }
  function buildAllTasks(key) {
    return cached(`tasksAll:${key}`, () => {
      const d = dOf(key); if (!d) return []; const out = []; const groups = {};
      d.schedules.filter((sc) => sc.status === 'active' && !subDaily(sc)).forEach((sc) => {
        const e = sc.subject.kind === 'eq' ? eqRaw(key, sc.subject.id) : null;
        const cg = e && SET_JOB.test(sc.name) ? cgOfEq(key, e.id) : null;
        if (cg) {
          const gid = `cg_${cg.id}_${h36(sc.name)}`; let g = groups[gid];
          if (!g) { g = groups[gid] = { id: gid, kind: 'group', name: sc.name, workType: sc.workType, typeName: e.type, code: e.dbType || e.code, scheduleIds: [], eqIds: [], sc, cg: { id: cg.id, name: cg.name } }; out.push(g); }
          g.scheduleIds.push(sc.id); g.eqIds.push(e.id); return;
        }
        if (e && GROUPED.includes(sc.workType)) {
          const code = e.dbType || e.code; const gid = `g_${code}_${h36(sc.name)}`; let g = groups[gid];
          if (!g) { g = groups[gid] = { id: gid, kind: 'group', name: sc.name, workType: sc.workType, typeName: e.type, code, scheduleIds: [], eqIds: [], sc }; out.push(g); }
          g.scheduleIds.push(sc.id); g.eqIds.push(e.id); return;
        }
        out.push({ id: sc.id, kind: 'single', name: sc.name, workType: sc.workType, typeName: e ? e.type : null, code: e ? e.dbType || e.code : null, scheduleIds: [sc.id], eqIds: e ? [e.id] : [], plantLevel: !e, sc });
      });
      /* v7: condition-based work is filed at the plant (eqIds empty: it is no equipment's task); its line names the equipment it reads */
      lineWorkOf(key).forEach((lw) => { const w = lineWorkView(key, lw); out.push({ id: lw.id, kind: 'line', name: lw.name, workType: 'condition', workLabel: 'Raised by a reading', typeName: null, code: null, scheduleIds: [], eqIds: w.eqId ? [w.eqId] : [], tags: w.eqId ? [w.eqTag] : [], plantLevel: !w.eqId, upId: null, filed: w.filed, toConfirm: false, line: `${lw.name} · ${w.filed.text}`, shared: null, every: null, everyText: w.whenText, basis: 'condition', intervalH: null, perDay: 0, source: null, flowId: lw.flowId || null, generalTaskId: null, anchor: 'line', statutory: false, from: w, sc: null }); });
      return out.map((v) => {
        if (v.kind === 'line') return v;
        const sc = v.sc; const n = v.eqIds.length; const I = intervalH(sc, rateOfEq(eqRaw(key, v.eqIds[0])));
        const gt = sc.task ? C.taskById(sc.task) : C.taskByFlow(sc.flow);
        return { id: v.id, kind: v.kind, name: v.name, workType: v.workType, workLabel: C.WT_LABEL[v.workType] || v.workType, typeName: v.typeName, code: v.code, scheduleIds: v.scheduleIds, eqIds: v.eqIds, tags: v.eqIds.map((id) => (eqRaw(key, id) || {}).tag), plantLevel: !!v.plantLevel, toConfirm: v.kind === 'group' && !v.cg, cg: v.cg || null, line: v.cg ? `${v.name} · ${v.cg.name}` : v.kind === 'group' ? `${v.name} · ${n} ${noun(v.typeName, n)}` : v.plantLevel ? `${v.name} · the plant` : `${v.name} · ${(eqRaw(key, v.eqIds[0]) || {}).tag}`, shared: v.cg ? `one task for the control group ${v.cg.name}` : v.kind === 'group' && n > 1 ? `shared task for ${n} ${noun(v.typeName, n)}` : null, every: C.cadenceOf(sc), everyText: C.every(sc), basis: sc.basis, intervalH: I, perDay: 24 / I, source: cadenceInfo(key, sc.id), flowId: sc.flow || (gt && gt.flow) || null, generalTaskId: gt ? gt.id : null, anchor: sc.anchor || 'fixed', statutory: !!sc.statutory, sc };
      });
    });
  }
  const taskIdOfSchedule = (key, scId) => { const t = buildTasks(key).find((x) => x.scheduleIds.includes(scId)); return t ? t.id : null; };
  function taskStateOf(key, id) {
    const P = PS(key); const st = P.tasks[id];
    if (lineWorkOf(key).some((lw) => lw.id === id)) { const h = st ? st.history || [] : []; if (P.state !== 'live') return { due: null, lastDone: st ? st.lastDone : null, status: 'waiting', done: [], history: h }; return st && (st.status === 'due' || st.status === 'doing') ? st : { due: null, lastDone: st ? st.lastDone : null, status: 'armed', done: [], history: h, raisedAt: null }; }
    if (P.state !== 'live') return { due: null, lastDone: st ? st.lastDone : null, status: 'waiting', done: st ? st.done || [] : [], history: st ? st.history || [] : [] };
    return st || { due: null, lastDone: null, status: 'upcoming', done: [], history: [] };
  }
  function ensureTaskStates(key, mode) {
    const P = PS(key); if (P.state !== 'live') return;
    buildTasks(key).forEach((v) => {
      if (v.kind === 'line') { if (!P.tasks[v.id]) P.tasks[v.id] = { due: null, lastDone: null, status: 'armed', done: [], history: [], startedAt: null }; return; }
      if (P.tasks[v.id] && P.tasks[v.id].due != null) return; const I = v.intervalH * HOUR; const prev = P.tasks[v.id] || {};
      /* v7: run-hours work is not spread: it falls due when its hour meter gets there (from the reading at its last service, or at go live) */
      const mp = meterProfile(key, v.sc);
      if (mp) { const last = prev.lastDone != null ? prev.lastDone : null; const due = meterDue(key, v.sc, { lastDone: last }); P.tasks[v.id] = { due, lastDone: last, status: due <= now() ? 'due' : 'upcoming', done: [], history: prev.history || [], startedAt: null }; return; }
      let due; if (prev.lastDone != null) due = Math.max(prev.lastDone + I, now()); else if (mode === 'seed') due = now() + (spreadFrac(v.id) - 0.15) * I; else due = now() + spreadFrac(v.id) * I;
      due = Math.round(due / MIN) * MIN;
      P.tasks[v.id] = { due, lastDone: prev.lastDone != null ? prev.lastDone : (mode === 'seed' ? due - I : null), status: due <= now() ? 'due' : 'upcoming', done: [], history: prev.history || [], startedAt: null };
    });
  }
  function taskView(key, v) {
    const st = taskStateOf(key, v.id); const f = v.flowId ? C.flow(v.flowId) || flowOf(v.flowId) : null;
    const { sc: sc0, ...vv } = v;   /* v7: the raw schedule stays inside core */
    return { ...vv, meter: meterProfile(key, sc0) ? meterLeft(key, sc0, st) : null, runHours: sc0 && sc0.meter && (sc0.basis === 'meter' || sc0.basis === 'either') ? runHoursInfo(key, sc0.id) : null, due: st.due, lastDone: st.lastDone, status: st.status, statusLabel: LABELS.taskStatus[st.status], overdue: st.status !== 'waiting' && st.status !== 'armed' && st.due != null && now() > st.due + (v.kind === 'line' ? 24 : Math.max(2, v.intervalH * 0.2)) * HOUR, raisedAt: st.raisedAt || null, raisedBy: st.raisedBy || null, done: (st.done || []).slice(), steps: f ? f.steps.map((x) => ({ id: x.id, type: x.type, text: x.text, link: x.link || null, links: x.links || null })) : [], history: (st.history || []).slice(), startedAt: st.startedAt || null };
  }
  function tasks(key, opts) {
    const o = opts || {}; if (!PS(key)) return [];
    return buildTasks(key).map((v) => taskView(key, v)).filter((t) => (!o.eqId || t.eqIds.includes(o.eqId) || t.upId === o.eqId) && (!o.status || (o.status === 'open' ? ['due', 'doing'].includes(t.status) : t.status === o.status)))
      .sort((a, b) => ({ doing: 0, due: 1, upcoming: 2, armed: 3, waiting: 4 }[a.status] - { doing: 0, due: 1, upcoming: 2, armed: 3, waiting: 4 }[b.status]) || ((a.due || 0) - (b.due || 0)));
  }
  function task(key, id) { const v = buildTasks(key).find((x) => x.id === id || x.scheduleIds.includes(id)); return v ? taskView(key, v) : null; }
  const taskGroups = (key) => tasks(key).filter((t) => t.kind === 'group');
  const tasksPerDay = (key, opts) => buildTasks(key).reduce((n, v) => n + (opts && opts.each ? Math.max(1, v.eqIds.length) : 1) * v.perDay, 0);
  function startTask(key, id) { const v = task(key, id); if (!v) return { ok: false, error: 'No such task.' }; const P = PS(key); if (P.state !== 'live') return { ok: false, error: 'Tasks start when the plant goes live.' }; const st = P.tasks[v.id] || (P.tasks[v.id] = { due: now(), lastDone: null, status: 'due', done: [], history: [] }); st.status = 'doing'; st.startedAt = now(); touch(); persist(); return { ok: true, task: task(key, v.id) }; }
  function doTaskStep(key, id, stepId) { const v = task(key, id); if (!v) return { ok: false, error: 'No such task.' }; const P = PS(key); const st = P.tasks[v.id] || (P.tasks[v.id] = { due: null, lastDone: null, status: 'doing', done: [], history: [] }); const k = String(stepId); st.done = st.done || []; const i = st.done.map(String).indexOf(k); if (i >= 0) st.done.splice(i, 1); else st.done.push(stepId); if (st.status === 'due' || st.status === 'upcoming') { st.status = 'doing'; st.startedAt = now(); } touch(); persist(); return { ok: true, done: st.done.slice() }; }
  function doneTask(key, id) {
    const v = task(key, id); if (!v) return { ok: false, error: 'No such task.' }; const P = PS(key); if (P.state !== 'live') return { ok: false, error: 'Tasks start when the plant goes live.' };
    const st = P.tasks[v.id] || (P.tasks[v.id] = { due: now(), lastDone: null, status: 'due', done: [], history: [] });
    if (v.kind === 'line') { if (st.status !== 'due' && st.status !== 'doing') return { ok: false, error: 'Nothing to do yet: the task is raised when the reading crosses its line.' }; (st.history = st.history || []).push({ due: st.due, done: now(), late: st.due != null && now() > st.due + 24 * HOUR, raisedBy: st.raisedBy || null }); Object.assign(st, { lastDone: now(), due: null, status: 'armed', done: [], startedAt: null, raisedAt: null, raisedBy: null }); touch(); persist(); return { ok: true, task: task(key, v.id) }; }
    const I = v.intervalH * HOUR;
    (st.history = st.history || []).push({ due: st.due, done: now(), late: st.due != null && now() > st.due + Math.max(2, v.intervalH * 0.2) * HOUR });
    let next = v.anchor === 'last' || st.due == null ? now() + I : st.due + I; while (next <= now()) next += I;
    const md = meterDue(key, v.sc, { lastDone: now() }); if (md != null) next = md;   /* v7: run-hours work: from the meter reading now */
    Object.assign(st, { lastDone: now(), due: Math.round(next / MIN) * MIN, status: 'upcoming', done: [], startedAt: null, calDue: null });
    touch(); persist(); return { ok: true, task: task(key, v.id) };
  }
  function setLastDone(key, id, date) {
    const v = task(key, id); if (!v) return { ok: false, error: 'No such task.' }; const ms = toMs(date); if (ms == null) return { ok: false, error: 'Pick a date.' }; if (ms > now()) return { ok: false, error: 'Last done cannot be in the future.' };
    const P = PS(key); if (v.kind === 'line') return { ok: false, error: 'Condition-based work has no last done date: it is raised by its reading.' };
    const st = P.tasks[v.id] || (P.tasks[v.id] = { due: null, lastDone: null, status: 'upcoming', done: [], history: [] }); st.lastDone = ms; st.calDue = null;
    if (P.state === 'live') { const md = meterDue(key, v.sc, { lastDone: ms }); st.due = md != null ? md : ms + v.intervalH * HOUR; st.status = st.status === 'doing' ? 'doing' : st.due <= now() ? 'due' : 'upcoming'; }
    addActivity(now(), key, `${v.name}: last done set to ${fmtDay(ms)}`, 'config'); touch(); persist(); return { ok: true, task: task(key, v.id) };
  }
  function dueTasks(key, toT, out) {
    const P = PS(key); if (P.state !== 'live') return; ensureTaskStates(key);
    buildTasks(key).forEach((v) => {
      const st = P.tasks[v.id]; if (st && st.status === 'upcoming') { const md = meterDue(key, v.sc, st); if (md != null) st.due = md; }   /* v7: run-hours work follows its meter */
      if (st && st.status === 'upcoming' && st.due != null && st.due <= toT) { st.status = 'due'; if (out) out.tasksDue.push({ plant: key, id: v.id, name: v.name, due: st.due }); }
    });
  }
  /* v7: ONE rule for a task's next due date when its interval changes (a library publish, a change here, a difference that ends) and for
     Where it lands' preview of it (rule 9): from its last real completion (if that makes it due already, it falls due now), else from the
     day of the change, never later than it already was; run-hours work also by its hour meter. An "either" task never done keeps that
     calendar date in calDue so its meter does not count it from go live again. scNew carries the new interval, scOld the one before. */
  function dueAfterChange(key, scNew, scOld, st, t) {
    const s0 = st || {}; const rnd = (x) => Math.round(x / MIN) * MIN;
    if (meterProfile(key, scNew)) {
      let calDue = s0.lastDone == null && s0.calDue != null ? s0.calDue : null;
      if (s0.lastDone == null && scNew.basis === 'either' && scNew.every && scNew.every.n) {
        const P = PS(key); const calH = (x) => (x && x.n ? x.n * (C.UNIT_HOURS[x.unit] || 24) * HOUR : Infinity);
        const was = calDue != null ? calDue : (P.goLiveAt != null ? P.goLiveAt : t) + calH(scOld && scOld.every);
        calDue = rnd(Math.min(was, t + calH(scNew.every)));
      }
      return { due: meterDue(key, scNew, { ...s0, calDue }), calDue };
    }
    const e = scNew.subject && scNew.subject.kind === 'eq' ? eqRaw(key, scNew.subject.id) : null; const I = intervalH(scNew, rateOfEq(e)) * HOUR;
    if (s0.lastDone != null) return { due: rnd(s0.lastDone + I), calDue: null };
    return { due: rnd(Math.min(s0.due != null ? s0.due : Infinity, t + I)), calDue: null };
  }
  /* v7: apply that rule to the task a schedule belongs to (Live plants), after its interval or run-hours changed here */
  function recountTask(key, scId, scOld) {
    const P = PS(key); if (!P || P.state !== 'live') return; const tid = taskIdOfSchedule(key, scId); const st = tid ? P.tasks[tid] : null; const v = tid ? buildTasks(key).find((x) => x.id === tid) : null;
    if (!st || !v) return; const r = dueAfterChange(key, v.sc, scOld, st, now()); st.due = r.due; if (r.calDue != null) st.calDue = r.calDue; if (st.status === 'upcoming' && st.due <= now()) st.status = 'due';
  }

  /* ── issues: records and actions ───────────────────────────────────────────────────────────── */
  const ISSUE_ORDER = { open: 0, diagnosing: 0, fixing: 0, verifying: 0, closed: 1 };
  function issues(key, opts) {
    const o = opts || {}; const P = PS(key); if (!P) return [];
    return P.issues.filter((i) => (!o.eqId || i.eqId === o.eqId || i.causedBy === o.eqId) && (!o.status || (o.status === 'open' ? i.status !== 'closed' : o.status === 'closed' ? i.status === 'closed' : i.status === o.status)) && (o.commissioning == null || i.commissioning === o.commissioning))
      .slice().sort((a, b) => ISSUE_ORDER[a.status] - ISSUE_ORDER[b.status] || (a.status !== 'closed' ? (RANK[b.band] || 0) - (RANK[a.band] || 0) || b.opened - a.opened : b.closed - a.closed));
  }
  const issueRaw = (key, id) => (PS(key) ? PS(key).issues.find((i) => i.id === id) || null : null);
  const issue = (key, id) => issueRaw(key, id);
  const libFlow = (id) => (id ? (C.S.lib && C.S.lib.flows.find((f) => f.id === id)) || ((window.SEED && window.SEED.flows) || []).find((f) => f.id === id) || null : null);
  const flowOf = (id) => libFlow(id);
  /* v7/3: the diagnostic flow an alert's issues start: the plant's own pick, else the library's */
  const diagOfAlert = (key, a) => (a && a.flowPick && libFlow(a.flowPick)) || withPlant(key, () => C.diagFor(a));
  function setAlertFlow(key, alertId, flowId) {
    const a = alertRaw(key, alertId); if (!a) return { ok: false, error: 'No such alert.' }; const f = flowId ? libFlow(flowId) : null;
    if (flowId && (!f || f.kind !== 'diagnostic')) return { ok: false, error: 'Pick a diagnostic flow.' };
    const was = diagOfAlert(key, a); if ((was ? was.id : null) === (f ? f.id : null)) return { ok: true, changed: false };
    if (f) a.flowPick = f.id; else delete a.flowPick;
    addActivity(now(), key, `${a.name}: its issues now start ${f ? `the diagnostic flow ${f.name}` : 'the library\'s diagnostic flow'}${was ? ` (was ${was.name})` : ''}`, 'config');
    touch(); persist(); return { ok: true, changed: true };
  }
  const causeOf = (id) => (id ? (C.S.lib && C.S.lib.causes.find((c) => c.id === id)) || ((window.SEED && window.SEED.causes) || []).find((c) => c.id === id) || null : null);
  function fixFlowFor(causeId, sensorName) { const c = causeOf(causeId); if (!c) return null; if (c.fix && libFlow(c.fix)) return libFlow(c.fix); if (c.sensorFault) { const id = (window.CAL_FLOWS || {})[sensorName] || window.CAL_FLOW_DEFAULT; return libFlow(id); } return null; }
  function diagFor(key, iss) { const i = typeof iss === 'string' ? issueRaw(key, iss) : iss; if (!i) return null; return libFlow(i.diag && i.diag.flowId); }
  function linksOfStep(stepRef) {
    let st = stepRef; if (stepRef && stepRef.flowId != null && stepRef.stepId != null) { const f = libFlow(stepRef.flowId); st = f ? f.steps.find((x) => String(x.id) === String(stepRef.stepId)) : null; }
    if (stepRef && stepRef.kind && stepRef.id && !stepRef.type) return [stepRef];
    return !st ? [] : st.links && st.links.length ? st.links : st.link ? [st.link] : [];
  }
  function linkedTask(stepRef) {
    const all = linksOfStep(stepRef).map((l) => { const x = C.linkTarget(l); if (!x) return null; const f = libFlow(x.flow); return { kind: x.kind, id: x.id, name: x.name, flowId: x.flow, steps: f ? f.steps.map((s) => ({ id: s.id, type: s.type, text: s.text })) : [] }; }).filter(Boolean);
    if (!all.length) return null; const first = all.find((x) => x.kind === 'task') || all[0]; return { ...first, all };
  }
  function taskForGeneral(key, generalTaskId, eqId) { const list = buildTasks(key).filter((v) => v.generalTaskId === generalTaskId); const t = (eqId && list.find((v) => v.eqIds.includes(eqId))) || list[0]; return t ? t.id : null; }
  const issueTypes = (typeName) => (window.ISSUES || []).filter((i) => !typeName || (i.homeTypes || []).includes(typeName)).map((i) => ({ id: i.id, name: i.name, homeTypes: i.homeTypes, flowId: i.flow, detection: i.detection || [], foundBy: [...new Set((i.detection || []).map((x) => x.kind))], causes: (i.causes || []).length, homeToConfirm: HOME_TO_CONFIRM.includes(i.id) }));
  /* the terms an issue opened under, in words, and whether the alert's limit has moved since (rule 10) */
  function issueTerms(key, issueId) {
    const iss = issueRaw(key, issueId); if (!iss || !iss.terms) return null; const tm = iss.terms; const s = sensorRaw(key, iss.sensorId) || { unit: tm.unit }; const kind = s.kind;
    const live = iss.alertId != null && !!alertRaw(key, iss.alertId);
    const now2 = live ? bandsInfo(key, iss.sensorId, tm.dir).bands[tm.band] : null; const limitMoved = live && !same(now2, tm.limit);
    /* v7: the hold and the clear are terms too (rule 10); an Emergency fires on the first reading, so its hold never differs */
    const holdNow = live ? timingInfo(key, iss.alertId, 'hold').value : null, clearNow = live ? timingInfo(key, iss.alertId, 'clear').value : null;
    const holdMoved = live && tm.band !== 'emergency' && tm.hold != null && !same(holdNow, tm.hold); const clearMoved = live && tm.clear != null && !same(clearNow, tm.clear);
    const changed = limitMoved || holdMoved || clearMoved;
    const bits = [limitMoved ? `the old limit ${fmtVal(tm.limit, tm.unit, kind)}${now2 != null ? ` (now ${fmtVal(now2, tm.unit, kind)})` : ' (now no limit)'}` : '', holdMoved ? `must hold for ${tm.hold} min (now ${holdNow} min)` : '', clearMoved ? `must clear for ${tm.clear} min (now ${clearNow} min)` : ''].filter(Boolean);
    return { band: tm.band, limit: tm.limit, dir: tm.dir, hold: tm.hold, clear: tm.clear, text: `Opened under: ${BAND_LABEL[tm.band]} ${kind === 'status' ? 'when' : dirWord(tm.dir)} ${fmtVal(tm.limit, tm.unit, kind)}, must hold for ${tm.band === 'emergency' ? 0 : tm.hold} min, must clear for ${tm.clear} min`, changed, limitNow: now2, holdNow, clearNow, changedText: changed ? `Opened under ${joinAnd(bits)}` : null };
  }
  function diagStep(key, issueId) {
    const iss = issueRaw(key, issueId); if (!iss || iss.status === 'closed' || iss.diag.causeId || iss.diag.open) return null; const f = libFlow(iss.diag.flowId); if (!f || !f.steps.length) return null;
    const p = iss.diag.path; if (!p.length) return f.steps[0]; const nx = p[p.length - 1].next; return nx == null ? null : f.steps.find((x) => String(x.id) === String(nx)) || null;
  }
  function setCause(key, iss, causeId, at) {
    const c = causeOf(causeId); if (!c) return; iss.diag.causeId = causeId; ilog(iss, at, `Root cause: ${c.name}`);
    const e = iss.eqId ? eqRaw(key, iss.eqId) : null; iss.causedBy = null; iss.sensorFault = !!c.sensorFault;
    if (e && (c.types || []).length && !(c.types || []).includes(e.type)) {
      const cands = dOf(key).equipment.filter((x) => c.types.includes(x.type)); const pick = cands.find((x) => x.status === 'running') || cands[0];
      if (pick) { iss.causedBy = pick.id; ilog(iss, at, `Caused by ${pick.tag} (${pick.type})`); }
    }
  }
  function answer(key, issueId, stepId, ans) {
    const iss = issueRaw(key, issueId); if (!iss) return { ok: false, error: 'No such issue.' }; if (iss.status === 'closed') return { ok: false, error: 'This issue is closed.' };
    const cur = diagStep(key, issueId); if (!cur) return { ok: false, error: iss.diag.causeId ? 'The root cause is found: start the fix.' : 'There is no diagnostic step to answer.' };
    if (stepId != null && String(cur.id) !== String(stepId)) return { ok: false, error: 'Answer the current step first.' };
    let dest = null; let said = ans;
    if (cur.type === 'reading') { const v = Number(ans); if (!Number.isFinite(v)) return { ok: false, error: 'Enter the reading as a number.' }; dest = cur.answers ? (v > cur.split ? cur.answers.Above : cur.answers.Below) : null; said = v; }
    else if (cur.answers) { const k = Object.keys(cur.answers).find((x) => x.toLowerCase() === String(ans).toLowerCase()); if (!k) return { ok: false, error: `Answer one of: ${Object.keys(cur.answers).join(', ')}.` }; dest = cur.answers[k]; said = k; }
    const t = now(); if (iss.status === 'open') { iss.status = 'diagnosing'; ilog(iss, t, 'Diagnosis started'); }
    const entry = { stepId: cur.id, answer: said, at: t, next: dest && dest.t === 'step' ? dest.id : null }; iss.diag.path.push(entry);
    ilog(iss, t, `${String(cur.text || '').replace(/[.\s]+$/, '')}: ${said}`);
    if (!dest || dest.t === 'open') { iss.diag.open = (dest && dest.text) || 'The diagnostic ends here without a root cause. Tell the Lead, or close it with a note.'; ilog(iss, t, iss.diag.open); }
    else if (dest.t === 'cause') setCause(key, iss, dest.id, t);
    touch(); persist(); return { ok: true, next: diagStep(key, issueId), causeId: iss.diag.causeId, causedBy: iss.causedBy, open: iss.diag.open || null };
  }
  function chooseCause(key, issueId, causeId) { const iss = issueRaw(key, issueId); if (!iss || iss.status === 'closed') return { ok: false, error: 'No open issue.' }; if (!causeOf(causeId)) return { ok: false, error: 'No such root cause.' }; const t = now(); if (iss.status === 'open') iss.status = 'diagnosing'; ilog(iss, t, 'Skipped the diagnostic: the reason is known'); iss.diag.open = null; setCause(key, iss, causeId, t); touch(); persist(); return { ok: true, causeId, causedBy: iss.causedBy }; }
  function startFix(key, issueId) {
    const iss = issueRaw(key, issueId); if (!iss || iss.status === 'closed') return { ok: false, error: 'No open issue.' }; if (!iss.diag.causeId) return { ok: false, error: 'Find the root cause first.' };
    const s = iss.sensorId ? sensorRaw(key, iss.sensorId) : null; const f = fixFlowFor(iss.diag.causeId, s ? s.name : null); const t = now();
    iss.fix = { flowId: f ? f.id : null, done: [] }; iss.status = f && f.steps.length ? 'fixing' : 'verifying';
    ilog(iss, t, f ? `Fix started: ${f.name}` : 'No fix steps for this root cause: check the readings and verify'); touch(); persist(); return { ok: true, flowId: iss.fix.flowId, status: iss.status };
  }
  /* v7: a question step ("Is the filter element clean?") takes an answer, Yes or No, and the log records it ("Is the filter element
     clean? No"); the same answer again takes it back. Other steps tick on and off. */
  function fixStep(key, issueId, stepId, answer) {
    const iss = issueRaw(key, issueId); if (!iss || iss.status === 'closed') return { ok: false, error: 'No open issue.' }; const f = libFlow(iss.fix.flowId); if (!f) return { ok: false, error: 'Start the fix first.' };
    const st = f.steps.find((x) => String(x.id) === String(stepId)); if (!st) return { ok: false, error: 'No such step.' };
    const i = iss.fix.done.map(String).indexOf(String(stepId)); const t = now(); const text = String(st.text || '').replace(/[.\s]+$/, '');
    if (st.type === 'question') {
      const ans = answer === 'Yes' || answer === 'No' ? answer : null; if (!ans) return { ok: false, error: 'Answer Yes or No.' };
      const ansMap = iss.fix.answers || (iss.fix.answers = {});
      if (i >= 0 && ansMap[st.id] === ans) { iss.fix.done.splice(i, 1); delete ansMap[st.id]; }
      else { if (i < 0) iss.fix.done.push(st.id); ansMap[st.id] = ans; ilog(iss, t, `${text}${/\?$/.test(text) ? '' : ':'} ${ans}`); }
    } else if (i >= 0) iss.fix.done.splice(i, 1); else { iss.fix.done.push(st.id); ilog(iss, t, `Done: ${text}`); }
    const all = f.steps.every((x) => iss.fix.done.map(String).includes(String(x.id)));
    iss.status = all ? 'verifying' : 'fixing'; if (all) ilog(iss, t, 'All fix steps done: verify with the readings'); touch(); persist(); return { ok: true, done: iss.fix.done.slice(), status: iss.status };
  }
  function verify(key, issueId, ok) {
    const iss = issueRaw(key, issueId); if (!iss || iss.status === 'closed') return { ok: false, error: 'No open issue.' }; const t = now();
    if (ok) { const c = causeOf(iss.diag.causeId); closeIssue(key, iss, t, iss.sensorFault ? 'sensor fault' : 'fixed', `Verified and closed: the readings show it worked${c ? ` (${c.name})` : ''}`); touch(); persist(); return { ok: true, status: 'closed' }; }
    ilog(iss, t, 'The readings do not show it worked: back to the diagnosis'); iss.status = 'diagnosing'; iss.diag = { flowId: iss.diag.flowId, path: [], causeId: null }; iss.causedBy = null; iss.fix = { flowId: null, done: [] }; iss.sensorFault = false;
    touch(); persist(); return { ok: true, status: 'diagnosing' };
  }
  function close(key, issueId, opts) {
    const iss = issueRaw(key, issueId); if (!iss || iss.status === 'closed') return { ok: false, error: 'No open issue.' }; const o = opts || {};
    if (o.falseAlarm && !String(o.note || o.why || '').trim()) return { ok: false, error: 'Say why it was a false alarm.' };
    iss.falseAlarm = !!o.falseAlarm; closeIssue(key, iss, now(), o.falseAlarm ? 'false alarm' : 'fixed', o.falseAlarm ? `Closed as a false alarm: ${o.note || o.why}` : `Closed${o.note ? `: ${o.note}` : ''}`); touch(); persist(); return { ok: true };
  }
  function report(key, eqId, issueTypeId, opts) {
    const e = eqRaw(key, eqId); const it = (window.ISSUES || []).find((i) => i.id === issueTypeId); if (!e) return { ok: false, error: 'No such equipment.' }; if (!it) return { ok: false, error: 'That problem is not in the library.' };
    const P = PS(key); const band = (opts && opts.band) || 'minor'; const t = now(); const commissioning = P.state === 'commissioning';
    const iss = { id: nextId('is'), plant: key, alertId: null, issueTypeId, title: it.name, eqId, sensorId: null, band, peak: null, opened: t, closed: null, cleared: null, status: 'open', terms: null, commissioning, told: [], diag: { flowId: it.flow && libFlow(it.flow) ? it.flow : null, path: [], causeId: null }, fix: { flowId: null, done: [] }, causedBy: null, falseAlarm: false, closedHow: null, reported: true, homeToConfirm: HOME_TO_CONFIRM.includes(issueTypeId), log: [] };
    iss.told = commissioning ? tellList(key, band, true, t).filter((x) => x.how === 'in the app') : tellList(key, band, false, t);
    ilog(iss, t, `Reported by ${ME} on ${e.tag}: ${it.name}`); P.issues.unshift(iss); addActivity(t, key, `Problem reported on ${e.tag}: ${it.name}`, 'issue');
    touch(); persist(); return { ok: true, issue: iss, id: iss.id };
  }

  /* "The sensor reads wrong": a sensor-fault issue on the reading's equipment, already at its root cause, whose fix is the probe's calibration */
  function reportSensorFault(key, sensorId, opts) {
    const s = sensorRaw(key, sensorId); if (!s || String(sensorId).startsWith('m:')) return { ok: false, error: 'No such reading.' }; const e = homeOf(key, s); if (!e) return { ok: false, error: 'This reading is not on a piece of equipment.' };
    const open = PS(key).issues.find((i) => i.sensorFault && i.sensorId === sensorId && i.status !== 'closed'); if (open) return { ok: true, issue: open, id: open.id, already: true };
    const P = PS(key); const t = now(); const cal = dOf(key).schedules.find((x) => x.workType === 'calibration' && x.probe === sensorId && x.status === 'active');
    const iss = { id: nextId('is'), plant: key, alertId: null, issueTypeId: null, title: `Sensor fault: ${s.name} on ${e.tag}`, eqId: e.id, sensorId, band: 'minor', peak: null, opened: t, closed: null, cleared: null, status: 'diagnosing', terms: null, commissioning: P.state === 'commissioning', told: [], diag: { flowId: null, path: [], causeId: null }, fix: { flowId: null, done: [] }, causedBy: null, falseAlarm: false, closedHow: null, sensorFault: true, reported: true, log: [] };
    iss.told = tellList(key, 'minor', P.state === 'commissioning', t).filter((x) => P.state !== 'commissioning' || x.how === 'in the app');
    ilog(iss, t, `Reported by ${ME}: ${sname(s)} reads wrong${opts && opts.note ? ` (${opts.note})` : ''}`); setCause(key, iss, 'c_probe', t);
    P.issues.unshift(iss); addActivity(t, key, `Sensor fault reported: ${sname(s)} on ${e.tag}`, 'issue');
    touch(); persist(); return { ok: true, issue: iss, id: iss.id, calibrationTaskId: cal ? taskIdOfSchedule(key, cal.id) : null };
  }
  /* the root causes an issue can land on: its diagnostic's, then its workbook issue's, in order (for "I know the reason") */
  function causesFor(key, issueId) {
    const iss = issueRaw(key, issueId); if (!iss) return []; const f = libFlow(iss.diag.flowId); const ids = [];
    if (f) f.steps.forEach((st) => Object.values(st.answers || {}).forEach((x) => { if (x && x.t === 'cause' && !ids.includes(x.id)) ids.push(x.id); }));
    const it = iss.issueTypeId ? (window.ISSUES || []).find((i) => i.id === iss.issueTypeId) : null; (it ? it.causes || [] : []).forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    return ids.map(causeOf).filter(Boolean).map((c) => ({ id: c.id, name: c.name, types: c.types || [], sensorFault: !!c.sensorFault, fixFlowId: c.fix || null }));
  }

  /* ── reviews: What the Visualization has, What the library brings ───────────────────────────────────── */
  function scadaReview(key) {
    return cached(`scada:${key}`, () => {
      const P = PS(key); const d = dOf(key); const groups = withPlant(key, () => C.typeGroups());
      const view = (e) => ({ eqId: e.id, tag: e.tag, name: e.name, drawn: C.dbName(e.code), stored: e.type, typeDiffers: !!e.code && !!e.dbType && e.code !== e.dbType && !e.offer && !e.subtype, readings: d.sensors.filter((s) => s.on === 'eq:' + e.id && !s.nextPhase).length, nextPhaseReadings: d.sensors.filter((s) => s.on === 'eq:' + e.id && s.nextPhase).length, form: e.form || null });
      return {
        readAt: P.scadaReadAt || P.since,
        groups: groups.map((g) => ({ typeName: g.type, code: g.code, count: g.eqs.length, accepted: !!P.scada.accepted[g.type], acceptedAt: P.scada.accepted[g.type] || null, inDb: !!g.entry && !g.eqs.some((e) => e.notInDb), equipment: g.eqs.map(view) })),
        notInDb: d.equipment.filter((e) => e.notInDb).map((e) => ({ eqId: e.id, tag: e.tag, name: e.name, code: e.code, stored: e.dbType })),
        typeDiffers: d.equipment.filter((e) => e.code && e.dbType && e.code !== e.dbType && !e.offer && !e.subtype).map((e) => ({ eqId: e.id, tag: e.tag, name: e.name, drawn: C.dbName(e.code), stored: e.type })),
        nextPhase: d.sensors.filter((s) => s.nextPhase).map((s) => { const e = homeOf(key, s); return { sensorId: s.id, name: s.name, tag: s.tag, eqId: e ? e.id : null, eqTag: e ? e.tag : null }; }),
        elements: withPlant(key, () => C.drawingElements()).reduce((n, g) => n + g.count, 0),
      };
    });
  }
  function acceptScadaGroup(key, typeName, opts) {
    const P = PS(key); const g = scadaReview(key).groups.find((x) => x.typeName === typeName); if (!g) return { ok: false, error: 'No such equipment type at this plant.' };
    if (P.scada.accepted[typeName]) return { ok: true, already: true };
    P.scada.accepted[typeName] = now(); if (!(opts && opts.quiet)) addActivity(now(), key, `Accepted what the Visualization found: ${plural(g.count, typeName)}`, 'scada');
    touch(); if (!(opts && opts.noSave)) persist(); return { ok: true };
  }
  function acceptAllScada(key) { const gs = scadaReview(key).groups.filter((g) => !g.accepted); gs.forEach((g) => acceptScadaGroup(key, g.typeName, { quiet: true, noSave: true })); if (gs.length) addActivity(now(), key, `Accepted what the Visualization found: ${plural(gs.length, 'equipment type')}`, 'scada'); touch(); persist(); return { ok: true, count: gs.length }; }
  /* v7/4: review the exceptions, not everything. The first time a plant being set up is opened, what was read cleanly is taken as it
     is: every equipment type the database knows, every alert and task the library proposes that can be used, and the proposed
     structure. Nothing is sent before go live, so this is safe; a person then only turns off what does not fit. */
  function autoSetup(key) {
    const P = PS(key); if (!P || !dOf(key) || P.state !== 'commissioning' || P.auto) return { ok: true, already: true };
    P.auto = now(); const a = acceptAllScada(key); if (a.count && S.activity.length) S.activity[S.activity.length - 1].who = 'Automatic';
    const b = acceptAllFor(key, {}, { quiet: true }); const st = structOf(key);
    if (st.ups.length && !P.structureOk) P.structureOk = now();
    addActivity(now(), key, `Set up by default from what was read: ${plural(b.alerts || 0, 'alert')} On trial and ${plural(b.tasks || 0, 'task')} accepted${st.ups.length ? `, the structure taken as proposed (${plural(st.ups.length, 'unit process', 'unit processes')})` : ''}. Only what needs a person is left to look at`, 'config', null);
    touch(); persist(); return { ok: true, types: a.count, alerts: b.alerts || 0, tasks: b.tasks || 0 };
  }
  function findItem(key, eqId, kind, name) {
    const d = dOf(key);
    if (eqId === 'plant') { const sc = d.schedules.find((x) => x.subject.kind === 'plant' && x.name === name); return sc ? { type: 'schedule', obj: sc } : null; }
    const e = eqRaw(key, eqId); if (!e) return null;
    if (kind === 'alert') { const a = d.alerts.find((x) => x.subject && x.subject.id === eqId && x.name === `${name} — ${e.tag}`); return a ? { type: 'alert', obj: a } : null; }
    if (kind === 'condition') { const w = d.conditionWork.find((x) => x.subject.id === eqId && x.name === name); return w ? { type: 'work', obj: w } : null; }
    let sc = d.schedules.find((x) => x.subject && x.subject.id === eqId && x.name === name);
    if (!sc && / calibration$/.test(name)) { const sn = name.replace(/ calibration$/, ''); const s = d.sensors.find((x) => x.on === 'eq:' + eqId && x.name === sn); if (s) sc = d.schedules.find((x) => x.workType === 'calibration' && x.probe === s.id); }
    return sc ? { type: 'schedule', obj: sc } : null;
  }
  function itemDecided(key, it) {
    if (!it) return null;
    if (it.type === 'alert') { const st = alertState(key, it.obj.id); return st === 'draft' ? null : st === 'off' ? 'rejected' : 'accepted'; }
    return it.obj.status === 'draft' ? null : it.obj.status === 'off' ? 'rejected' : 'accepted';
  }
  function libraryReview(key) {
    return cached(`libreview:${key}`, () => { const d = dOf(key); return [...d.equipment.map((e) => reviewRow(key, e.id)), reviewRow(key, 'plant')]; });
  }
  function reviewRow(key, eqId) {
    return cached(`librow:${key}:${eqId}`, () => {
      const d = dOf(key); const P = PS(key); let row = null;
      withPlant(key, () => {
        if (eqId === 'plant') {
          const prof = C.plantProfile(); row = { eqId: 'plant', tag: d.plant.name, name: d.plant.name, typeName: `${d.plant.type} plant`, plantLevel: true, proposals: [] };
          (prof.rounds || []).filter((r) => C.cadenceOf(r) && !subDaily(r)).forEach((r) => { const pid = `plant|task|${r.name}`; const sc = d.schedules.find((x) => x.subject.kind === 'plant' && x.name === r.name); row.proposals.push({ pid, kind: 'task', name: r.name, eqId: 'plant', tag: d.plant.name, typeName: row.typeName, every: C.cadenceOf(r), workType: r.workType, detail: `${cap(everyText(C.cadenceOf(r)))} · ${C.WT_LABEL[r.workType] || r.workType}`, decided: sc ? itemDecided(key, { type: 'schedule', obj: sc }) : null, reason: (P.decisions[pid] || {}).reason || null }); });
          return;
        }
        const e = d.equipment.find((x) => x.id === eqId); if (!e) return;
        {
          row = { eqId: e.id, tag: e.tag, name: e.name, typeName: e.type, notInDb: !!e.notInDb, proposals: [] };
          const it = C.eqInheritItems(e); const inh = C.inheritance(e);
          if (it) it.items.forEach((x) => {
            const kind = x.kind === 'alert' ? 'alert' : x.kind === 'work' ? 'condition' : 'task'; const pid = `${e.id}|${kind}|${x.name}`;
            const p = { pid, kind, name: x.name, eqId: e.id, tag: e.tag, typeName: e.type, decided: null, detail: '', reason: (P.decisions[pid] || {}).reason || null };
            if (kind === 'alert') {
              const ta = inh && inh.alerts.find((a) => a.name === x.name); const s = ta ? d.sensors.find((y) => y.on === 'eq:' + e.id && y.name === ta.sensorKind && !y.nextPhase) : null;
              if (ta) { p.dir = ta.direction; p.reading = ta.sensorKind; }
              if (s) { p.sensorId = s.id; const bi = bandsInfo(key, s.id, ta.direction); p.limits = bi; p.detail = limitsText(bi.bands, ta.direction, s.unit, s.kind); }
              else if (ta) p.detail = limitsText(norm4(ta.limits), ta.direction, (C.readingOf(ta.sensorKind) || {}).unit || '', (C.readingOf(ta.sensorKind) || {}).kind || '');
              if (x.fromForm) p.fromForm = true;
            } else if (kind === 'task') {
              const ts = inh && inh.schedules.find((y) => y.name === x.name); p.every = x.every || (ts ? C.cadenceOf(ts) : { n: 1, unit: 'month' }); p.workType = x.workType || (ts ? ts.workType : 'calibration');
              /* v7: the same words before and after accepting: "Every 150 run-hours" when the equipment has an hour meter */
              const mh = x.meterHours || (ts && ts.meterHours) || null; const hasMeter = d.sensors.some((y) => y.on === 'eq:' + e.id && y.kind === 'meter');
              const basis = mh && hasMeter ? (x.basis || (ts && ts.basis) || (ts && ts.every && ts.every.n ? 'either' : 'meter')) : 'calendar';
              p.basis = basis; p.meterHours = mh && hasMeter ? mh : null;
              p.everyText = basis === 'calendar' ? `${everyText(p.every)}${mh && !hasMeter && p.every && p.every.unit === 'hour' && +p.every.n === +mh ? ' of clock time (no hour meter here)' : ''}` : C.every({ every: basis === 'meter' ? null : (ts && ts.every && ts.every.n ? ts.every : p.every), basis, meterHours: mh });
              p.detail = `${cap(p.everyText)} · ${C.WT_LABEL[p.workType] || 'Calibration'}`;
            }
            else { const ts = inh && inh.schedules.find((y) => y.name === x.name); const rd = ts ? C.readingOf(ts.sensorKind) || {} : {}; const dw = ts && ts.doWhen != null && Number.isFinite(+ts.doWhen) ? fmtVal(+ts.doWhen, rd.unit || '', rd.kind) : ts ? ts.doWhen : null; p.detail = ts ? `When ${ts.sensorKind} passes ${dw}` : 'When a reading passes a line'; }
            if (!x.ok) p.blockedBy = `Needs a ${(x.why.match(/needs an? (.+?) reading/) || [])[1] || 'reading'} reading the Visualization doesn't send`;
            else p.decided = itemDecided(key, findItem(key, e.id, kind, x.name));
            if (kind === 'task' && p.basis === 'calendar' && everyH(p.every) != null && everyH(p.every) < 24) return;   /* v7/4: nothing more often than daily */
            row.proposals.push(p);
          });
          /* v7: a next-phase item set by a form answer ("Discharge pressure limits from the Maximum Head answer") is limits or a setting,
             not a task: kind 'condition' with its own label, so it never reads as work the plant will get */
          if (it) (it.next || []).filter((n) => n.kind === 'alert' || n.kind === 'work').forEach((n) => { const fromAnswer = n.kind === 'work' && /\banswer\b/i.test(`${n.name} ${n.note || ''}`); row.proposals.push({ pid: `${e.id}|${n.kind === 'alert' ? 'alert' : 'task'}|${n.name}`, kind: n.kind === 'alert' ? 'alert' : fromAnswer ? 'condition' : 'task', kindLabel: fromAnswer ? (/\blimits\b/i.test(n.name) ? 'Limits' : 'Setting') : null, name: n.name, eqId: e.id, tag: e.tag, typeName: e.type, decided: null, detail: n.note || 'Reads a connection', blockedBy: 'Next phase', nextPhase: true }); });
        }
      });
      return row;
    });
  }
  function materialize(key, eqId, at) {
    const P = PS(key); if (P.mat[eqId]) return; const d = dOf(key); const t = at != null ? at : now();
    const before = { a: new Set(d.alerts.map((x) => x.id)), s: new Set(d.schedules.map((x) => x.id)), w: new Set(d.conditionWork.map((x) => x.id)) };
    withPlant(key, () => { if (eqId === 'plant') C.inheritPlant(); else { const e = C.eq(eqId); if (e) C.inheritEquipment(e); } });
    d.alerts.filter((x) => !before.a.has(x.id)).forEach((x) => { x.status = 'draft'; x.open = 0; P.alerts[x.id] = { state: 'draft', since: t, trialSince: null }; });
    d.schedules.filter((x) => !before.s.has(x.id)).forEach((x) => { x.status = 'draft'; x.open = 0; });
    d.conditionWork.filter((x) => !before.w.has(x.id)).forEach((x) => { x.status = 'draft'; x.open = 0; });
    if (eqId !== 'plant') d.milestones = d.milestones || [];
    P.mat[eqId] = true; touch(); if (eqId !== 'plant') syncEquipment(key, eqId);
  }
  function decide(key, pid, verdict, opts) {
    const o = opts || {}; const P = PS(key); if (!P) return { ok: false, error: 'No such plant.' };
    const parts2 = String(pid).split('|'); const eqId = parts2[0], kind = parts2[1], name = parts2.slice(2).join('|');
    const row = (eqId === 'plant' || eqRaw(key, eqId)) ? reviewRow(key, eqId) : null; const p = row && row.proposals.find((x) => x.pid === pid);
    if (!p) return { ok: false, error: 'No such proposal.' }; if (p.blockedBy) return { ok: false, error: p.blockedBy };
    if (verdict !== 'accept' && verdict !== 'reject') return { ok: false, error: 'Accept or reject.' };
    const t = o.at != null ? o.at : now();
    materialize(key, eqId, t); const it = findItem(key, eqId, kind, name); if (!it) return { ok: false, error: 'The library item could not be found on this equipment.' };
    if (verdict === 'accept') {
      if (it.type === 'alert') { if (alertState(key, it.obj.id) !== 'trial' && alertState(key, it.obj.id) !== 'on') putAlertState(key, it.obj.id, 'trial', t); }
      else it.obj.status = 'active';
      const ov = it.type === 'alert' ? ovOnOff(key, { alertId: it.obj.id }) : it.type === 'schedule' ? ovOnOff(key, { scheduleId: it.obj.id }) : null; if (ov) endOverride(ov, 'Accepted after all', t);
    } else {
      if (it.type === 'alert') putAlertState(key, it.obj.id, 'off', t); else it.obj.status = 'off';
      const tg = it.type === 'alert' ? { kind: 'onoff', alertId: it.obj.id } : it.type === 'schedule' ? { kind: 'onoff', scheduleId: it.obj.id } : null;
      if (tg && !ovOnOff(key, tg)) addOverride(key, tg, 'off', 'on', { reason: 'tuned', note: o.reason || 'Not for this plant' }, t);
    }
    P.decisions[pid] = { decided: verdict === 'accept' ? 'accepted' : 'rejected', at: t, reason: o.reason || null };
    if (!o.quiet) addActivity(t, key, `${verdict === 'accept' ? 'Accepted' : 'Not for this plant'}: ${p.name} on ${p.tag}${verdict === 'accept' && it.type === 'alert' ? ' (On trial)' : ''}${o.reason ? ` · ${o.reason}` : ''}`, 'config');
    touch(); if (P.state === 'live' && it.type === 'schedule') ensureTaskStates(key);
    if (!o.noSave) persist(); return { ok: true, pid, decided: P.decisions[pid].decided };
  }
  function acceptAllFor(key, sel, opts) {
    const o = sel || {}; const rows = libraryReview(key).filter((r) => (o.eqId ? r.eqId === o.eqId : o.typeName ? r.typeName === o.typeName : true));
    const todo = []; rows.forEach((r) => r.proposals.forEach((p) => { if (!p.blockedBy && !p.decided) todo.push(p); }));
    let n = 0, na = 0; todo.forEach((p) => { const r = decide(key, p.pid, 'accept', { quiet: true, noSave: true, at: opts && opts.at }); if (r.ok) { n++; if (p.kind === 'alert') na++; } });
    /* v7: say "N alerts go On trial" only when alerts were accepted; otherwise say why none were */
    const blockedAlerts = []; rows.forEach((r) => r.proposals.forEach((p) => { if (p.kind === 'alert' && p.blockedBy && !p.nextPhase) blockedAlerts.push(p); }));
    const live = PS(key).state === 'live'; const noAlertWhy = blockedAlerts.length ? "its alerts need readings the Visualization doesn't send" : 'there were no alerts to accept';
    const tail = na ? `${plural(na, 'alert')} ${na === 1 ? 'goes' : 'go'} On trial${live ? ' for 7 days' : ''}` : `${live ? 'tasks start now' : 'tasks start at go live'}; ${noAlertWhy}`;
    if (n && !(opts && opts.quiet)) addActivity(opts && opts.at != null ? opts.at : now(), key, `Accepted ${plural(n, 'library proposal')}${o.typeName ? ` for ${o.typeName}` : o.eqId ? ` for ${(eqRaw(key, o.eqId) || {}).tag || 'the plant'}` : ''}; ${tail}`, 'config');
    touch(); persist(); return { ok: true, count: n, alerts: na, tasks: n - na, blockedAlerts: blockedAlerts.length, tail };
  }
  /* v7: what "Accept all" would do, shown before the click: worked out on the real data by acceptAllFor itself, then put back */
  function acceptAllPreview(key, sel) {
    const P = PS(key); if (!P || !dOf(key)) return null; const perDay = (each) => Math.round(tasksPerDay(key, { each }));
    const before = { perDay: perDay(false), perDayEach: perDay(true), tasks: buildTasks(key).length };
    const after = dryRun(key, () => { const r = acceptAllFor(key, sel || {}, { quiet: true }); return { count: r.count, alerts: r.alerts, proposals: r.count, perDay: perDay(false), perDayEach: perDay(true), tasks: buildTasks(key).length, tail: r.tail }; });
    return { live: P.state === 'live', count: after.count, alerts: after.alerts, newTasks: after.tasks - before.tasks, before, after, eachPhrase: eachOf(key).phrase };
  }

  /* ── the one checklist ─────────────────────────────────────────────────────────── */
  function checklist(key) {
    return cached(`check:${key}`, () => {
      const P = PS(key); const d = dOf(key); if (!P || !d) return null;
      const sr = scadaReview(key); const lr = libraryReview(key); const ppl = people(key); const base = `#/p/${key}`;
      const decidable = []; lr.forEach((r) => r.proposals.forEach((p) => { if (!p.blockedBy) decidable.push(p); }));
      const undecided = decidable.filter((p) => !p.decided);
      const accG = sr.groups.filter((g) => g.accepted).length;
      const reachOp = ppl.filter((p) => p.role === 'l1' && p.reachable); const reachLead = ppl.filter((p) => (p.role === 'l3' || p.role === 'l4') && p.reachable);
      const watching = d.alerts.filter((a) => ['trial', 'on'].includes(alertState(key, a.id)));
      const tracks = {
        scada: { label: 'What the Visualization has', done: accG, total: sr.groups.length, items: sr.groups, next: accG < sr.groups.length ? 'Review and accept what the Visualization found' : null, link: `${base}/scada` },
        library: { label: 'Alerts & Tasks', done: decidable.length - undecided.length, total: decidable.length, items: lr, next: undecided.length ? `Decide ${plural(undecided.length, 'proposal')}` : null, link: `${base}/library` },
        people: { label: 'Who is told', done: (reachOp.length ? 1 : 0) + (reachLead.length ? 1 : 0), total: 2, items: ppl, next: !reachOp.length || !reachLead.length ? 'Add a reachable Operator and Lead in the User Center' : null, link: null, linkText: 'Edit in the User Center' },
      };
      const blockers = [];
      if (sr.notInDb.length) blockers.push({ id: 'notindb', text: `${plural(sr.notInDb.length, 'piece', 'pieces')} of equipment has a type the database doesn't have: fix it in the Visualization, then read again`, link: `${base}/scada` });
      const live = P.state === 'live';
      if (!live && accG < sr.groups.length) blockers.push({ id: 'scada', text: accG ? `What the Visualization has is not all accepted: ${sr.groups.length - accG} of ${plural(sr.groups.length, 'equipment type')} to go` : `What the Visualization has is not accepted yet (${plural(sr.groups.length, 'equipment type')})`, short: `accept what the Visualization found (${plural(sr.groups.length - accG, 'type')})`, link: `${base}/scada` });
      if (!live && undecided.length) blockers.push({ id: 'library', text: undecided.length === 1 ? `One library proposal is not decided: ${undecided[0].name} on ${undecided[0].tag}` : `${undecided.length} library proposals are not decided yet`, short: undecided.length === 1 ? `decide ${undecided[0].name} on ${undecided[0].tag}` : `decide ${undecided.length} library proposals`, link: `${base}/library`, count: undecided.length, items: undecided.map((p) => ({ pid: p.pid, name: p.name, tag: p.tag })) });
      if (!watching.length) blockers.push({ id: 'alerts', text: live ? 'No alert is On' : 'No alert is On trial yet', short: 'put at least one alert On trial', link: `${base}/library` });
      if (!reachOp.length) blockers.push({ id: 'operator', text: 'No Operator can be reached: add one with a verified phone in the User Center', short: 'add a reachable Operator in the User Center', link: null });
      if (!reachLead.length) blockers.push({ id: 'lead', text: 'No Lead can be reached: add one with a verified phone in the User Center', short: 'add a reachable Lead in the User Center', link: null });
      const gaps = [];
      /* v7: one test for "no limits yet", used by the gap, the Readings filter and its chip: manual and lab readings count too (rule 14) */
      const noLim = readings(key).filter((r) => noLimitsYet(key, r));
      if (noLim.length) gaps.push({ id: 'nolimits', text: `${plural(noLim.length, 'reading')} with no limits`, link: `${base}/readings`, count: noLim.length, items: noLim.map((r) => ({ sensorId: r.id, tag: r.tag, name: r.name, eqId: r.eqId, manual: r.kind === 'manual' })) });
      const noisy = watching.filter((a) => alertState(key, a.id) === 'trial' && isNoisy(key, a.id));
      if (noisy.length) gaps.push({ id: 'noisy', text: noisy.length === 1 ? `${noisy[0].name} is noisy: ${round(trialStats(key, noisy[0].id).perDay, 1)} trial firings a day` : `${noisy.length} alerts are noisy (more than 10 trial firings a day)`, link: noisy.length === 1 ? `${base}/alert/${noisy[0].id}` : `${base}/equipment`, count: noisy.length, items: noisy.map((a) => ({ alertId: a.id, name: a.name, perDay: round(trialStats(key, a.id).perDay, 1) })) });
      const hasTask = (e) => d.schedules.some((sc) => sc.subject.kind === 'eq' && sc.subject.id === e.id && sc.workType !== 'calibration' && sc.status === 'active' && !subDaily(sc)) || d.conditionWork.some((w) => w.subject.id === e.id && w.status === 'active');
      const noTask = d.equipment.filter((e) => (e.expects || []).length && !hasTask(e));
      if (noTask.length) gaps.push({ id: 'notask', text: `${plural(noTask.length, 'piece', 'pieces')} of equipment with no maintenance task`, link: noTask.length === 1 ? `${base}/eq/${noTask[0].id}/tasks` : `${base}/equipment`, count: noTask.length, items: noTask.map((e) => ({ eqId: e.id, tag: e.tag })) });
      const types = [...new Set(d.equipment.map((e) => e.type))];
      const noDiag = (window.ISSUES || []).filter((i) => (i.homeTypes || []).some((t) => types.includes(t)) && !(i.flow && libFlow(i.flow)));
      if (noDiag.length) gaps.push({ id: 'nodiag', text: `${plural(noDiag.length, 'issue')} of this plant's types with no diagnostic`, link: '#/library', count: noDiag.length, items: noDiag.map((i) => ({ issueTypeId: i.id, name: i.name })) });
      if (sr.typeDiffers.length) gaps.push({ id: 'drawn', text: `${plural(sr.typeDiffers.length, 'piece', 'pieces')} of equipment drawn as one type and stored as another: fix it in the Visualization`, link: `${base}/scada`, count: sr.typeDiffers.length, items: sr.typeDiffers });
      if (P.state === 'commissioning') {
        const starts = Object.values(P.alerts).filter((x) => x.state === 'trial' && x.trialSince != null).map((x) => x.trialSince);
        const days = starts.length ? (now() - Math.min(...starts)) / DAY : 0;
        if (days < 3) gaps.push({ id: 'trialshort', text: starts.length ? (days * 24 < 1 ? 'The trial started just now: 3 days shows a full pattern' : `The trial has run ${days < 1 ? plural(Math.round(days * 24), 'hour') : plural(round(days, 1), 'day')}: 3 days shows a full pattern`) : 'The trial has not started: alerts go On trial when you accept them', link: base, count: 1 });
      }
      const canGoLive = P.state === 'commissioning' && !blockers.length;
      /* v7: one pattern, one plain sentence: "Go live is blocked by 1 thing: decide MLSS low on SBR-1", "Go live is blocked by 5 things.
         First: accept what the Visualization found (13 types)" */
      const firstWhat = blockers.length ? (blockers[0].short || (blockers[0].text[0].toLowerCase() + blockers[0].text.slice(1))) : '';
      const whyNot = P.state === 'live' ? 'The plant is already Live' : blockers.length === 1 ? `Go live is blocked by 1 thing: ${firstWhat}` : blockers.length ? `Go live is blocked by ${blockers.length} things. First: ${firstWhat}` : '';
      return { state: P.state, tracks, blockers, gaps, canGoLive, whyNot };
    });
  }

  /* ── go live and back ──────────────────────────────────────────────────────────────────────── */
  /* v7: the one wording for "tasks a day if each piece of equipment got its own", the same on every plant: shared tasks span
     several kinds of work, so no type is named (types lists the types whose shared tasks make the difference) */
  function eachOf(key) {
    const types = [...new Set(buildTasks(key).filter((v) => v.kind === 'group' && v.eqIds.length > 1).map((v) => v.typeName))];
    return { noun: 'piece of equipment', types, phrase: 'if each piece of equipment gets its own' };
  }
  function goLivePreview(key) {
    const d = dOf(key); const trial = d.alerts.filter((a) => alertState(key, a.id) === 'trial').length;
    const a = Math.round(tasksPerDay(key, { each: false })), b = Math.round(tasksPerDay(key, { each: true }));
    const ea = eachOf(key);
    /* v7: alerts On trial for under a day (e.g. a proposal accepted moments before) turn On without a trial: name them */
    const untried = d.alerts.filter((x) => alertState(key, x.id) === 'trial').map((x) => { const st = PS(key).alerts[x.id]; return { alertId: x.id, name: x.name, minutes: st && st.trialSince != null ? Math.max(0, Math.round((now() - st.trialSince) / MIN)) : 0 }; }).filter((x) => x.minutes < 24 * 60);
    const untriedText = !untried.length ? null : untried.length === 1 ? `${untried[0].name} has been On trial for ${fmtDur(untried[0].minutes)}; it turns On without a trial` : `${plural(untried.length, 'alert')} have been On trial for under a day (${untried.length <= 3 ? untried.map((x) => `${x.name}: ${fmtDur(x.minutes)}`).join(', ') : `the longest for ${fmtDur(Math.max(...untried.map((x) => x.minutes)))}`}); they turn On without a trial`;
    const changes = [`Alerts reach people: ${plural(trial, 'alert')} go from On trial to On`, 'Calls and the hooter start now', `Tasks start: ${a} a day${b !== a ? ` (${b} ${ea.phrase})` : ''}`, 'First due dates are spread across each task\'s interval; run-hours work falls due by its hour meter', 'Counts and metrics start today', 'Changes to structure need a reason from now on'];
    const wl = workLevel(key); if (wl && wl.leftOut.length) changes.splice(3, 0, `Work level ${wl.label}: ${plural(wl.leftOut.length, 'routine task')} left out. Alerts, preventive maintenance, calibration and statutory work are not affected`);
    if (untriedText) changes.splice(1, 0, untriedText);
    return { alertsOn: trial, tasksPerDay: a, tasksPerDayIfEach: b, eachNoun: ea.noun, eachPhrase: ea.phrase, untried, untriedText, firstDueSpread: true, changes, checklist: checklist(key) };
  }
  function goLive(key) {
    const cl = checklist(key); if (!cl) return { ok: false, error: 'No such plant.' }; if (!cl.canGoLive) return { ok: false, error: cl.whyNot };
    const P = PS(key); const pv = goLivePreview(key); const t = now();
    dOf(key).alerts.forEach((a) => { if (alertState(key, a.id) === 'trial') putAlertState(key, a.id, 'on', t); });
    P.state = 'live'; P.since = t; P.goLiveAt = t; P.engineAt = lastPollAtOrBefore(t); P.eng = {};
    touch(); ensureTaskStates(key, 'golive');
    addActivity(t, key, `Went live: ${plural(pv.alertsOn, 'alert')} On, calls and the hooter start, ${pv.tasksPerDay} tasks a day`, 'golive');
    touch(); persist(); return { ok: true, preview: pv };
  }
  function returnToCommissioning(key, reason) {
    const P = PS(key); if (!P) return { ok: false, error: 'No such plant.' }; if (P.state !== 'live') return { ok: false, error: 'The plant is already in Commissioning.' };
    if (!String(reason || '').trim()) return { ok: false, error: 'Say why the plant goes back to Commissioning.' };
    const t = now(); P.state = 'commissioning'; P.since = t; (P.returned = P.returned || []).push({ at: t, reason });
    dOf(key).alerts.forEach((a) => { if (alertState(key, a.id) === 'on') putAlertState(key, a.id, 'trial', t); });
    Object.values(P.tasks).forEach((st) => { st.due = null; st.status = 'upcoming'; st.done = []; });
    P.engineAt = lastPollAtOrBefore(t); P.eng = {};
    addActivity(t, key, `Back to Commissioning: ${reason}. Alerts run On trial; Emergencies are still sent to the Leads`, 'golive'); touch(); persist(); return { ok: true };
  }

  /* ── coverage (Live) ───────────────────────────────────────────────────────────────────────── */
  function coverage(key) {
    return cached(`cov:${key}`, () => {
      const P = PS(key); const d = dOf(key); const from = Math.max(now() - 30 * DAY, P.state === 'live' ? P.since : now() - 30 * DAY); const days = Math.max(1, (now() - from) / DAY);
      const counted = P.issues.filter((i) => !i.commissioning && i.opened >= from);
      const med = (xs) => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
      const rows = d.alerts.filter((a) => ['on', 'trial'].includes(alertState(key, a.id))).map((a) => {
        const list = counted.filter((i) => i.alertId === a.id); const closed = list.filter((i) => i.status === 'closed');
        const mm = closed.length ? Math.round(med(closed.map((i) => (i.closed - i.opened) / MIN))) : null;   /* v7: whole minutes; the UI formats them once */
        return { alertId: a.id, name: a.name, state: alertState(key, a.id), issues: list.length, firesPerDay: round(list.length / days, 2), falseAlarmShare: closed.length ? round(closed.filter((i) => i.falseAlarm).length / closed.length, 2) : null, medianCloseMin: mm, medianCloseH: mm != null ? round(mm / 60, 1) : null, open: list.filter((i) => i.status !== 'closed').length };
      }).sort((x, y) => y.firesPerDay - x.firesPerDay);
      const on = new Set(d.alerts.filter((a) => alertState(key, a.id) === 'on').map((a) => a.name.replace(/ — .*$/, '')));
      const types = [...new Set(d.equipment.map((e) => e.type))];
      const blind = (window.ISSUES || []).filter((i) => (i.homeTypes || []).some((t) => types.includes(t))).filter((i) => !(i.detection || []).some((x) => x.kind === 'sensor' && [x.alert, ...(x.alerts || [])].filter(Boolean).some((n) => on.has(n)))).map((i) => {
        const tids = [...new Set((i.detection || []).filter((x) => x.kind !== 'sensor').flatMap((x) => [x.task, ...(x.tasks || [])]).filter(Boolean))];
        const have = tids.map((id) => ({ id, task: buildTasks(key).find((v) => v.generalTaskId === id) })).filter((x) => x.task);
        const gt = tids.map((id) => C.taskById(id)).filter(Boolean);
        return { issueTypeId: i.id, name: i.name, homeTypes: i.homeTypes, foundBy: [...new Set((i.detection || []).filter((x) => x.kind !== 'sensor').map((x) => x.kind))], hasTask: have.length > 0, taskId: have.length ? have[0].task.id : null, taskName: have.length ? have[0].task.name : gt.length ? gt[0].name : null, homeToConfirm: HOME_TO_CONFIRM.includes(i.id) };
      });
      const allClosed = counted.filter((i) => i.status === 'closed');
      const changes = S.lib.changes.filter((c) => (c.plants || []).includes(key)).map((c) => ({ at: c.at, code: c.code, typeName: c.typeName, version: c.version, kind: c.kind, text: c.text, note: c.note }));
      return { state: P.state, since: P.since, from, days: round(days, 1), alerts: rows, blindSpots: blind, gaps: checklist(key).gaps, changes, sample: true,
        totals: { firesPerDay: round(counted.filter((i) => i.alertId).length / days, 2), falseAlarmShare: allClosed.length ? round(allClosed.filter((i) => i.falseAlarm).length / allClosed.length, 2) : null, medianCloseMin: allClosed.length ? Math.round(med(allClosed.map((i) => (i.closed - i.opened) / MIN))) : null, medianCloseH: allClosed.length ? round(med(allClosed.map((i) => (i.closed - i.opened) / MIN)) / 60, 1) : null, openIssues: P.issues.filter((i) => i.status !== 'closed').length, blindSpots: blind.length, blindWithoutTask: blind.filter((b) => !b.hasTask).length } };
    });
  }

  /* ── changing values at a plant (rule 7) ───────────────────────────────────────────────────── */
  function validateBands(bands, dir, s) {
    const vals = BANDS.map((b) => ({ b, v: bands[b] })).filter((x) => x.v != null);
    for (const x of vals) { if (!Number.isFinite(+x.v)) return `${BAND_LABEL[x.b]} must be a number.`; if (s && s.kind !== 'status' && (x.v < s.valid[0] || x.v > s.valid[1])) return `${BAND_LABEL[x.b]} ${fmtVal(x.v, s.unit)} is outside what ${s.name} can read (${fmtVal(s.valid[0], s.unit)} to ${fmtVal(s.valid[1], s.unit)}).`; }
    for (let i = 1; i < vals.length; i++) { const a = vals[i - 1], b = vals[i]; if (dir === 'below' ? !(b.v < a.v) : !(b.v > a.v)) return `${BAND_LABEL[b.b]} must be ${dir === 'below' ? 'lower' : 'higher'} than ${BAND_LABEL[a.b]}: each band goes further ${dir === 'below' ? 'down' : 'up'}.`; }
    return null;
  }
  function setLimits(key, sensorId, dir, bands, opts) {
    const o = opts || {}; const s = sensorRaw(key, sensorId); if (!s) return { ok: false, error: 'No such reading.' }; if (s.nextPhase) return { ok: false, error: `${s.name} is read on a connection: next phase.` };
    const next = norm4(bands); const D2 = dir || primaryDir(key, sensorId); const err = validateBands(next, D2, s); if (err) return { ok: false, error: err };
    const orphan = lineWorkOn(key, sensorId, D2).find((lw) => next[lw.band] == null);   /* v7: a line that raises a task cannot be removed under it */
    if (orphan) return { ok: false, error: `The ${BAND_LABEL[orphan.band]} line raises the task "${orphan.name}". Stop it raising the task before you remove the line.` };
    const bi = bandsInfo(key, sensorId, D2); const rov = ovReading(key, sensorId, D2); const t = now(); const changed = []; const ids = [];
    BANDS.forEach((b) => { if (!same(next[b], bi.perBand[b].value)) changed.push({ band: b, from: bi.perBand[b].value, to: next[b] }); });
    if (!changed.length) return { ok: true, changed: [], overrides: [] };
    if (!rov && !bi.libBands && !bi.formBands) { const r0 = addOverride(key, { kind: 'reading', sensorId, dir: D2 }, next, null, { reason: 'notinlib', note: o.note || '', reviewBy: null }, t); ids.push(r0.id); }
    else if (rov) { rov.value = next; rov.at = t; rov.author = ME; if (o.note) rov.note = o.note; ids.push(rov.id); }
    else {
      const leaving = BANDS.filter((b) => !same(next[b], bi.perBand[b].baseValue) && changed.some((c) => c.band === b));
      if (leaving.length) { const e2 = checkReason(o); if (e2) return { ok: false, error: e2, needsReason: true }; }
      BANDS.forEach((b) => {
        if (!changed.some((c) => c.band === b)) return; const ex = ovLimit(key, sensorId, D2, b); const baseV = bi.perBand[b].baseValue;
        if (same(next[b], baseV)) { if (ex) { endOverride(ex, 'Back to the library value', t); ids.push(ex.id); } return; }
        if (ex) { Object.assign(ex, { value: next[b], base: baseV, reason: o.reason, note: o.note, until: o.reason === 'fornow' ? toMs(o.until) : null, reviewBy: o.reason === 'fornow' ? toMs(o.until) : t + 182 * DAY, author: ME, at: t }); ids.push(ex.id); }
        else ids.push(addOverride(key, { kind: 'limit', sensorId, dir: D2, band: b }, next[b], baseV, o, t).id);
      });
    }
    syncSensor(key, sensorId);
    addActivity(t, key, `Changed limits on ${sname(s)}: ${changed.map((c) => bandChange(c.band, c.from, c.to, s.unit, s.kind)).join(', ')}${o.reason ? ` · ${LABELS.reason[o.reason].replace(' …', '')}${o.reason === 'fornow' ? ` ${fmtDay(toMs(o.until))}` : ''}` : ''}${o.note ? `: ${o.note}` : ''}`, 'config');
    touch(); persist(); return { ok: true, changed, overrides: ids };
  }
  function setValueGeneric(key, target, info, newValue, sameFn, opts, apply, describe) {
    const o = opts || {}; const t = now();
    if (sameFn(newValue, info.value)) return { ok: true, changed: false };
    const ov = findOv(key, (x) => JSON.stringify(x) === JSON.stringify(target));
    if (info.notInLib || (ov && ov.reason === 'notinlib')) { if (ov) { ov.value = newValue; ov.at = t; ov.author = ME; } apply(); addActivity(t, key, describe(), 'config'); touch(); persist(); return { ok: true, changed: true, overrideId: ov ? ov.id : null }; }
    if (sameFn(newValue, info.libValue)) { if (ov) endOverride(ov, 'Back to the library value', t); apply(); addActivity(t, key, describe(), 'config'); touch(); persist(); return { ok: true, changed: true }; }
    const e2 = checkReason(o); if (e2) return { ok: false, error: e2, needsReason: true };
    let id; if (ov) { Object.assign(ov, { value: newValue, base: info.libValue, reason: o.reason, note: o.note, until: o.reason === 'fornow' ? toMs(o.until) : null, reviewBy: o.reason === 'fornow' ? toMs(o.until) : t + 182 * DAY, author: ME, at: t }); id = ov.id; }
    else id = addOverride(key, target, newValue, info.libValue, o, t).id;
    apply(); addActivity(t, key, `${describe()} · ${LABELS.reason[o.reason].replace(' …', '')}${o.note ? `: ${o.note}` : ''}`, 'config'); touch(); persist(); return { ok: true, changed: true, overrideId: id };
  }
  function setAlertTiming(key, alertId, vals, opts) {
    const a = alertRaw(key, alertId); if (!a) return { ok: false, error: 'No such alert.' }; const v = vals || {}; const res = [];
    for (const which of ['hold', 'clear']) {
      if (v[which] == null) continue; const n = Math.round(+v[which]); if (!Number.isFinite(n) || n < 0 || n > 1440) return { ok: false, error: `Must ${which} for: give minutes between 0 and 1440.` };
      const info = timingInfo(key, alertId, which); const old = info.value;
      const r = setValueGeneric(key, { kind: which, alertId }, info, n, (x, y) => same(x, y), opts, () => syncAlert(key, alertId), () => `${a.name}: must ${which} for ${old} → ${n} min`);
      if (!r.ok) return r; res.push(r);
    }
    return { ok: true, results: res };
  }
  function setCadence(key, id, every, opts) {
    const tv = task(key, id); const scIds = tv ? tv.scheduleIds : schedRaw(key, id) ? [id] : []; if (!scIds.length) return { ok: false, error: 'No such task.' };
    /* v7: every = {n, unit} (the calendar) and/or {runHours} (the hour meter's part, for work that runs on run-hours) */
    const sc0 = schedRaw(key, scIds[0]); const meterOnly = !!(sc0 && sc0.meter && sc0.basis === 'meter'); const scOld = sc0 ? clone(sc0) : null;
    const rh = every && every.runHours != null && every.runHours !== '' ? Math.round(+every.runHours) : null;
    if (rh != null && (!Number.isFinite(rh) || rh < 1)) return { ok: false, error: 'Give the run-hours as a whole number, 1 or more.' };
    if (rh != null && !(sc0 && sc0.meter)) return { ok: false, error: 'This task does not run on an hour meter.' };
    let ev = every && every.n ? { n: Math.round(+every.n), unit: every.unit } : null;
    if (meterOnly && rh != null) ev = { n: rh, unit: 'hour' };
    if (!ev && rh == null) return { ok: false, error: 'Give how often: a number and hour, day, week, month or year.' };
    if (ev && (ev.n < 1 || !C.UNIT_HOURS[ev.unit])) return { ok: false, error: 'Give how often: a number and hour, day, week, month or year.' };
    const res = [];
    for (const scId of scIds) { const sc = schedRaw(key, scId); const tagT = sc.subject.kind === 'eq' ? ` on ${(eqRaw(key, sc.subject.id) || {}).tag}` : '';
      if (ev) { const info = cadenceInfo(key, scId); const old = meterOnly ? `every ${sc.meter.hours} run-hours` : everyText(info.value);
        const r = setValueGeneric(key, { kind: 'cadence', scheduleId: scId }, info, ev, sameEvery, opts, () => { sc.every = { ...ev }; if (meterOnly) sc.meter.hours = ev.n; touch(); }, () => `${sc.name}${tagT}: ${old} → ${meterOnly ? `every ${ev.n} run-hours` : everyText(ev)}`);
        if (!r.ok) return r; res.push(r); }
      if (rh != null && !meterOnly && sc.meter) { const info = runHoursInfo(key, scId); const old = info.value;
        const r = setValueGeneric(key, { kind: 'runhours', scheduleId: scId }, info, rh, (x, y) => same(x, y), opts, () => { sc.meter.hours = rh; touch(); }, () => `${sc.name}${tagT}: every ${old} → ${rh} run-hours`);
        if (!r.ok) return r; res.push(r); } }
    /* v7: the one rule (dueAfterChange): tasks never done since go live count the new interval from today too (rule 9) */
    if (tv) recountTask(key, scIds[0], scOld);
    touch(); persist(); return { ok: true, results: res };
  }
  function setTier(key, eqId, tier, opts) {
    const e = eqRaw(key, eqId); if (!e) return { ok: false, error: 'No such equipment.' }; if (!['A', 'B', 'C'].includes(tier)) return { ok: false, error: 'Pick a criticality: Critical, Essential or Standard.' };
    const info = tierInfo(key, eqId); const old = info.value;
    return setValueGeneric(key, { kind: 'tier', eqId }, info, tier, (x, y) => x === y, { ...opts, reason: (opts && opts.reason) || 'tuned' }, () => syncTier(key, eqId), () => `Criticality of ${e.tag}: ${C.TIER_LABEL[old] || old} → ${C.TIER_LABEL[tier]}`);
  }

  /* ── the ledger, read and acted on ─────────────────────────────────────────────────────────── */
  function currentBaseOf(key, o) {
    const t = o.target;
    if (t.kind === 'limit') { const bi = bandsInfo(key, t.sensorId, t.dir); return bi ? bi.perBand[t.band].baseValue : null; }
    if (t.kind === 'hold' || t.kind === 'clear') { const i = timingInfo(key, t.alertId, t.kind); return i ? i.libValue : null; }
    if (t.kind === 'cadence') { const i = cadenceInfo(key, t.scheduleId); return i ? i.libValue : null; }
    if (t.kind === 'tier') { const i = tierInfo(key, t.eqId); return i ? i.libValue : null; }
    if (t.kind === 'runhours') { const i = runHoursInfo(key, t.scheduleId); return i ? i.libValue : null; }
    if (t.kind === 'onoff') return 'on'; return null;
  }
  /* v7: where the value a difference is measured against comes from: the Visualization (e.g. a 22 kW motor) or the library */
  function baseSourceOf(key, o) {
    const t = o.target;
    if (t.kind === 'limit') { const bi = bandsInfo(key, t.sensorId, t.dir); const pb = bi && bi.perBand[t.band]; return pb && pb.formValue != null ? { from: 'form', why: bi.formWhy || LABELS.chip.form } : { from: 'lib', why: null }; }
    if (t.kind === 'cadence') { const i = cadenceInfo(key, t.scheduleId); return i && i.baseFrom === 'form' ? { from: 'form', why: LABELS.chip.form } : { from: 'lib', why: null }; }
    return { from: 'lib', why: null };
  }
  const sameValue = (kind, a, b) => (kind === 'cadence' ? sameEvery(a, b) : typeof a === 'number' || typeof b === 'number' ? same(a, b) : a === b);
  /* v7: 'same' — the library (or Visualization) value now equals the plant's own value: nothing differs any more, so the obvious step is
     Back to the library value; it is not shown as Library changed since */
  const SAME_KINDS = ['limit', 'hold', 'clear', 'cadence', 'tier', 'runhours'];
  function ovState(key, o) {
    if (o.endedAt != null) return 'ended'; if (o.reason === 'fornow' && o.until != null && o.until <= now()) return 'ended';
    if (o.reason !== 'notinlib') { const cb = currentBaseOf(key, o); if (SAME_KINDS.includes(o.target.kind) && o.value != null && cb != null && sameValue(o.target.kind, o.value, cb)) return 'same'; if (!sameValue(o.target.kind, o.base, cb)) return 'libchanged'; }
    if (o.reviewBy != null && o.reviewBy <= now()) return 'review'; return 'ok';
  }
  function fmtTargetValue(key, o, v) {
    const t = o.target;
    if (t.kind === 'limit') { const s = sensorRaw(key, t.sensorId) || {}; return v == null ? 'none' : fmtVal(v, s.unit, s.kind); }
    if (t.kind === 'reading') { const s = sensorRaw(key, t.sensorId) || {}; return v ? limitsText(v, t.dir, s.unit, s.kind) : 'none'; }
    if (t.kind === 'hold' || t.kind === 'clear') return v == null ? '—' : `${v} min`;
    if (t.kind === 'cadence') { const sc = schedRaw(key, t.scheduleId); if (v && sc && sc.meter && sc.basis === 'meter' && v.unit === 'hour') return `every ${v.n} run-hours`; return v ? everyText(v) : '—'; }
    if (t.kind === 'runhours') return v ? `every ${v} run-hours` : '—';
    if (t.kind === 'tier') return v ? (C.TIER_LABEL[v] || v) : '—';
    if (t.kind === 'onoff') return v === 'off' ? 'Off' : 'On';
    if (t.kind === 'alert') return v || '—'; return v == null ? '—' : String(v);
  }
  function ovDecorate(key, o) {
    const t = o.target; let what = '', eqId = null, tag = null, typeName = null, libRaw = null;
    if (t.sensorId) { const s = sensorRaw(key, t.sensorId) || {}; const e = homeOf(key, s); eqId = e ? e.id : null; tag = e ? e.tag : null; typeName = e ? e.type : null; what = t.kind === 'limit' ? `${sname(s)} · ${BAND_LABEL[t.band]} ${dirWord(t.dir)}` : `${sname(s)} · limits ${dirWord(t.dir)}`; }
    if (t.alertId) { const a = alertRaw(key, t.alertId) || { name: '' }; const e = alertEq(key, a); eqId = e ? e.id : null; tag = e ? e.tag : null; typeName = e ? e.type : null; what = t.kind === 'hold' ? `${a.name} · must hold for` : t.kind === 'clear' ? `${a.name} · must clear for` : t.kind === 'onoff' ? `${a.name} · On or Off` : a.name; }
    if (t.scheduleId) { const sc = schedRaw(key, t.scheduleId) || { name: '', subject: {} }; const e = sc.subject.kind === 'eq' ? eqRaw(key, sc.subject.id) : null; eqId = e ? e.id : null; tag = e ? e.tag : null; typeName = e ? e.type : null; what = t.kind === 'onoff' ? `${sc.name} on ${tag || 'the plant'} · On or Off` : t.kind === 'runhours' ? `${sc.name} on ${tag || 'the plant'} · run-hours` : `${sc.name} on ${tag || 'the plant'} · how often`; }
    if (t.kind === 'tier') { const e = eqRaw(key, t.eqId) || {}; eqId = e.id; tag = e.tag; typeName = e.type; what = `${e.tag} · criticality`; }
    libRaw = o.reason === 'notinlib' ? null : currentBaseOf(key, o);
    const st = ovState(key, o); const bs = o.reason === 'notinlib' ? { from: null, why: null } : baseSourceOf(key, o);
    /* v7 (card D25): a value nobody recorded a reason for that equals the library's own fixed number, while the plant's base is now the
       Visualization's rule: probably never chosen here. It is kept, marked, and listed first so a review can adopt the rule in one step. */
    let oldLib = null;
    if (o.reason === 'unrecorded' && t.kind === 'limit' && bs.from === 'form' && typeName) { const s0 = sensorRaw(key, t.sensorId) || {}; const lb = libBands(typeName, s0.name, t.dir, false); if (lb && same(lb[t.band], o.value)) oldLib = { value: lb[t.band], text: lb[t.band] == null ? 'none' : fmtVal(lb[t.band], s0.unit, s0.kind) }; }
    /* v7: baseFrom 'form'|'lib' says whether libValue is the Visualization's value (with its reason, e.g. "From the Visualization: 22 kW motor") or the library's */
    return { ...o, baseFrom: bs.from, baseWhy: bs.why, baseLabel: bs.from === 'form' ? 'Visualization' : bs.from === 'lib' ? 'Library' : null, backText: bs.from === 'form' ? 'Back to the Visualization value' : 'Back to the library value', plantName: plantName(key), state: st, stateLabel: LABELS.overrideState[st], reasonLabel: o.reason === 'fornow' && o.until ? `For now, until ${fmtDay(o.until)}` : LABELS.reason[o.reason], what, eqId, tag, typeName, typeCode: typeName ? codeOfType(typeName) : null, plantValue: fmtTargetValue(key, o, o.value), libValue: o.reason === 'notinlib' ? 'Not in the library' : fmtTargetValue(key, o, libRaw), baseValue: o.reason === 'notinlib' ? null : fmtTargetValue(key, o, o.base), libRaw, baseDiffers: st === 'libchanged', sameAsLib: st === 'same', atText: o.at != null ? fmtDay(o.at) : '—', reviewByText: o.reviewBy != null ? fmtDay(o.reviewBy) : '—', untilText: o.until != null ? fmtDay(o.until) : null, authorText: o.author || 'Not recorded', oldLib: !!oldLib, oldLibText: oldLib ? oldLib.text : null };
  }
  function overrides(opts) {
    const o = opts || {}; const list = S.overrides.filter((x) => !o.plant || x.plant === o.plant).map((x) => ovDecorate(x.plant, x));
    return list.filter((x) => (o.state === 'all' ? true : o.state ? x.state === o.state : x.state !== 'ended') && (!o.reason || x.reason === o.reason));
  }
  /* v7: the bands a reading would have if these limit overrides went back to their base; null when that order is fine, else the reason */
  function revertOrderError(key, list) {
    const t0 = list[0].target; const s = sensorRaw(key, t0.sensorId) || {}; const bi = bandsInfo(key, t0.sensorId, t0.dir); if (!bi) return null;
    const next = { ...bi.bands }; list.forEach((o) => { next[o.target.band] = bi.perBand[o.target.band].baseValue; });
    const vals = BANDS.map((b) => ({ b, v: next[b] })).filter((x) => x.v != null);
    for (let i = 1; i < vals.length; i++) { const a = vals[i - 1], b = vals[i]; if (t0.dir === 'below' ? !(b.v < a.v) : !(b.v > a.v)) return `Send ${s.name || 'the reading'}'s other changed bands back too: ${BAND_LABEL[b.b]} ${fmtVal(b.v, s.unit, s.kind)} would sit ${t0.dir === 'below' ? 'above' : 'below'} ${BAND_LABEL[a.b]} ${fmtVal(a.v, s.unit, s.kind)}`; }
    return null;
  }
  function revertOne(o) {
    const key = o.plant; const d = ovDecorate(key, o); const back = d.baseFrom === 'form' ? 'the Visualization value' : 'the library value'; endOverride(o, `Back to ${back}`); const t = o.target;
    const scOld = t.scheduleId && (t.kind === 'cadence' || t.kind === 'runhours') ? clone(schedRaw(key, t.scheduleId) || null) : null;
    if (t.sensorId) syncSensor(key, t.sensorId); if (t.alertId && (t.kind === 'hold' || t.kind === 'clear')) syncAlert(key, t.alertId); if (t.scheduleId && t.kind === 'cadence') syncSched(key, t.scheduleId); if (t.kind === 'runhours') syncRunHours(key, t.scheduleId); if (t.kind === 'tier') syncTier(key, t.eqId);
    if (scOld) recountTask(key, t.scheduleId, scOld);   /* v7: the task's due date follows the value it went back to */
    if (t.kind === 'onoff' && t.alertId) putAlertState(key, t.alertId, 'trial'); if (t.kind === 'onoff' && t.scheduleId) { const sc = schedRaw(key, t.scheduleId); if (sc) sc.status = 'active'; }
    return d;
  }
  function revert(id) {
    const o = S.overrides.find((x) => x.id === id); if (!o) return { ok: false, error: 'No such deviation.' }; if (o.endedAt) return { ok: true, already: true };
    const key = o.plant;
    if (o.target.kind === 'limit') { const err = revertOrderError(key, [o]); if (err) return { ok: false, error: err, needsAll: true }; }
    const d = revertOne(o); const back = d.baseFrom === 'form' ? 'the Visualization value' : 'the library value';
    addActivity(now(), key, `Back to ${back}: ${d.what} (${d.plantValue} → ${d.libValue})`, 'config'); touch(); persist(); return { ok: true, baseFrom: d.baseFrom };
  }
  /* v7: what "Back to the library value" would do, checked before the dialog opens: whether this band alone keeps the bands in order,
     and if not, the bands that go back together, with their values (nothing changes) */
  function revertPreview(id) {
    const o = S.overrides.find((x) => x.id === id); if (!o || o.endedAt) return null; const key = o.plant;
    if (o.target.kind !== 'limit') return { ok: true, needsAll: false };
    const err = revertOrderError(key, [o]); if (!err) return { ok: true, needsAll: false };
    const list = S.overrides.filter((x) => x.plant === key && !x.endedAt && x.target.kind === 'limit' && x.target.sensorId === o.target.sensorId && x.target.dir === o.target.dir);
    const errAll = revertOrderError(key, list);
    return { ok: !errAll, needsAll: true, error: err, allError: errAll || null, bands: list.map((x) => { const d = ovDecorate(key, x); return { band: x.target.band, bandLabel: BAND_LABEL[x.target.band], from: d.plantValue, to: d.libValue }; }).sort((a, b) => RANK[a.band] - RANK[b.band]) };
  }
  /* v7: every changed band on one reading and direction goes back together (keeps the bands in order) */
  function revertAll(id) {
    const o = S.overrides.find((x) => x.id === id); if (!o) return { ok: false, error: 'No such deviation.' }; if (o.target.kind !== 'limit') return revert(id);
    const key = o.plant; const t0 = o.target; const list = S.overrides.filter((x) => x.plant === key && !x.endedAt && x.target.kind === 'limit' && x.target.sensorId === t0.sensorId && x.target.dir === t0.dir);
    if (!list.length) return { ok: true, already: true };
    const err = revertOrderError(key, list); if (err) return { ok: false, error: err };
    const ds = list.map((x) => ({ band: x.target.band, d: ovDecorate(key, x) })); list.forEach((x) => revertOne(x)); const s = sensorRaw(key, t0.sensorId) || {};
    const form = ds.some((x) => x.d.baseFrom === 'form');
    addActivity(now(), key, `Back to the ${form ? 'Visualization' : 'library'} values: ${sname(s)} ${dirWord(t0.dir)} (${ds.map((x) => `${BAND_LABEL[x.band]} ${x.d.plantValue} → ${x.d.libValue}`).join(', ')})`, 'config');
    touch(); persist(); return { ok: true, count: list.length, baseFrom: form ? 'form' : 'lib' };
  }
  function keep(id, opts) {
    const o = S.overrides.find((x) => x.id === id); if (!o || o.endedAt) return { ok: false, error: 'No such deviation.' }; const x = opts || {}; const key = o.plant;
    o.base = currentBaseOf(key, o); if (x.until != null) { const u = toMs(x.until); if (!u || u <= now()) return { ok: false, error: 'Pick a date after today.' }; o.reason = 'fornow'; o.until = u; o.reviewBy = u; } else { const r = toMs(x.reviewBy); o.reviewBy = r && r > now() ? r : now() + 182 * DAY; if (o.reason === 'unrecorded' || o.reason === 'fornow') { o.reason = 'tuned'; o.until = null; } }
    if (x.note) o.note = x.note; o.at = now(); o.author = ME;
    addActivity(now(), key, `Kept this plant's value: ${ovDecorate(key, o).what} · review by ${fmtDay(o.reviewBy)}`, 'config'); touch(); persist(); return { ok: true };
  }
  function suggest(arg) {
    let typeName, text, fromId = null, plantKey = null;
    if (typeof arg === 'string') { const o = S.overrides.find((x) => x.id === arg); if (!o) return { ok: false, error: 'No such deviation.' }; const d = ovDecorate(o.plant, o); typeName = d.typeName; plantKey = o.plant; fromId = o.id; text = `${plantName(o.plant)} uses ${d.plantValue} for ${d.what}${o.note ? ` (${o.note})` : ''}: should the library?`; }
    else { typeName = arg && arg.typeName; text = arg && arg.text; plantKey = (arg && arg.plant) || null; }
    if (!typeName || !String(text || '').trim()) return { ok: false, error: 'Say what the library should change.' };
    const sg = { id: nextId('sg'), at: now(), who: ME, typeName, code: codeOfType(typeName), text, fromOverride: fromId, plant: plantKey };
    S.lib.suggestions.push(sg); addActivity(now(), plantKey, `Suggested a library change for ${typeName}: ${text}`, 'library'); touch(); persist(); return { ok: true, suggestion: sg };
  }
  const suggestions = (code) => S.lib.suggestions.filter((x) => !code || x.code === code).slice().reverse();

  /* ── the library: types, drafts, Where it lands, publish ──────────────────────────────────── */
  const FAMILY = { vessel: 'Tanks and basins', rotating: 'Pumps, blowers and drives', fixed: 'Screens and fixed equipment', membrane: 'Membranes and filters', dosing: 'Dosing', valve: 'Valves', device: 'Devices and instruments' };
  // integrator: a tank with a rotating scraper (Clarifier Tank) is still listed with the tanks; maintenance still treats it as rotating
  const familyOf = (cat) => cat.family || (cat.archetype === 'rotating' && / Tank$/.test(cat.type) ? FAMILY.vessel : FAMILY[cat.archetype] || 'Other equipment');
  const libVersion = (code) => (S && S.lib.versions[code]) || 1;
  function libTypes() {
    return cached('libtypes', () => (window.CATALOGUE || []).map((cat) => {
      const per = ORDER.filter((k) => dOf(k)).map((k) => ({ key: k, name: plantName(k), count: dOf(k).equipment.filter((e) => e.type === cat.type).length })).filter((x) => x.count);
      const t = setOf(cat.type) || { alerts: [], schedules: [] };
      return { code: cat.code, typeName: cat.type, library: cat.library === 'process' ? 'process' : 'equipment', added: cat.addedBy === 'taxonomy', family: familyOf(cat), archetype: cat.archetype, tier: cat.tier, version: libVersion(cat.code), draft: !!S.lib.drafts[cat.code], plants: per, plantCount: per.length, equipmentCount: per.reduce((n, x) => n + x.count, 0), readings: cat.sensors.length, alerts: t.alerts.length, tasks: t.schedules.filter((x) => !subDaily(x)).length, issues: issueTypes(cat.type).length, generalTasks: C.tasksOf(cat.type).length, nextPhase: ((cat.nextPhase || {}).readings || []).length + ((cat.nextPhase || {}).alerts || []).length, suggestions: S.lib.suggestions.filter((x) => x.code === cat.code).length };
    }));
  }
  function libType(code) {
    const cat = catByCode(code); if (!cat) return null; const t = setOf(cat.type) || { alerts: [], schedules: [] }; const dr = S.lib.drafts[code] || null;
    const readingsL = cat.sensors.map((s) => { const dirs = [...new Set(t.alerts.filter((a) => a.sensorKind === s.name).map((a) => a.direction))]; if (!dirs.length) dirs.push(s.direction || 'above'); return { name: s.name, tag: s.tag, unit: s.unit, kind: s.kind, valid: s.valid, dirs: dirs.map((dir) => libLimits(cat.type, s.name, dir, { draft: !!dr })) }; });
    return { code, typeName: cat.type, family: familyOf(cat), archetype: cat.archetype, tier: cat.tier, version: libVersion(code), draft: dr ? libDraft(code) : null, readings: readingsL,
      alerts: t.alerts.map((a) => ({ name: a.name, reading: a.sensorKind, dir: a.direction, bands: norm4(a.limits), hold: libTiming(cat.type, a.sensorKind, a.direction, 'hold'), clear: libTiming(cat.type, a.sensorKind, a.direction, 'clear'), flowId: a.flow || null, issueTypeId: a.issue || null, nextPhase: C.onConnection(a.sensorKind) })),
      schedules: t.schedules.filter((x) => x.workType !== 'condition' && !subDaily(x)).map((x) => ({ name: x.name, workType: x.workType, workLabel: C.WT_LABEL[x.workType] || x.workType, every: libEveryOf(x), everyText: x.workType === 'condition' ? `when ${x.sensorKind} passes ${x.doWhen}` : C.every(x), draftEvery: dr && dr.schedules[x.name] ? dr.schedules[x.name] : null, draftEveryText: dr && dr.schedules[x.name] ? everyWith(x, dr.schedules[x.name]) : null, generalTaskId: x.task || null, flowId: x.flow || null })),
      issues: issueTypes(cat.type), generalTasks: C.tasksOf(cat.type).map((x) => ({ id: x.id, name: x.name, workType: x.workType, frequency: x.frequency, flowId: x.flow })), nextPhase: cat.nextPhase || { readings: [], alerts: [], work: [] },
      library: cat.library === 'process' ? 'process' : 'equipment', plants: (libTypes().find((x) => x.code === code) || {}).plants || [], changes: S.lib.changes.filter((c) => c.code === code), suggestions: suggestions(code), confirm: cat.confirm || null };
  }
  function draftDiffs(dr) {
    const out = []; if (!dr) return out;
    Object.keys(dr.limits).forEach((k) => { const [reading, dir] = k.split('|'); const cur = libBands(dr.typeName, reading, dir, false) || norm4(null); const nx = norm4(dr.limits[k]); const unit = (C.readingOf(reading) || {}).unit || ''; BANDS.forEach((b) => { if (!same(cur[b], nx[b])) out.push({ kind: 'limit', reading, dir, band: b, from: cur[b], to: nx[b], what: `${reading} · ${BAND_LABEL[b]} ${dirWord(dir)}`, text: `${reading} ${dirWord(dir)}: ${bandChange(b, cur[b], nx[b], unit, (C.readingOf(reading) || {}).kind)}`, safety: b === 'emergency' }); }); });
    Object.keys(dr.schedules).forEach((name) => { const ts = libSchedFor(dr.typeName, name); out.push({ kind: 'cadence', schedule: name, from: libEveryOf(ts), to: dr.schedules[name], what: `${name} · how often`, text: `${name}: ${ts ? C.every(ts) : everyText(libEveryOf(ts))} → ${everyWith(ts, dr.schedules[name])}` }); });
    Object.keys(dr.alerts).forEach((name) => { const ta = (setOf(dr.typeName) || { alerts: [] }).alerts.find((a) => a.name === name); ['hold', 'clear'].forEach((w) => { if (dr.alerts[name][w] == null) return; const cur = ta ? libTiming(dr.typeName, ta.sensorKind, ta.direction, w) : null; if (!same(cur, dr.alerts[name][w])) out.push({ kind: w, alert: name, from: cur, to: dr.alerts[name][w], what: `${name} · must ${w} for`, text: `${name}: must ${w} for ${cur} → ${dr.alerts[name][w]} min` }); }); });
    return out;
  }
  function libDraft(code) { const dr = S && S.lib.drafts[code]; if (!dr) return null; const diffs = draftDiffs(dr); return { ...clone(dr), diffs, kind: diffs.some((x) => x.safety) ? 'safety' : 'normal', version: libVersion(code), nextVersion: libVersion(code) + 1 }; }
  function editLib(code, change) {
    const cat = catByCode(code); if (!cat) return { ok: false, error: 'No such equipment type.' }; const c = change || {};
    const dr = S.lib.drafts[code] || { code, typeName: cat.type, base: libVersion(code), at: now(), limits: {}, schedules: {}, alerts: {} };
    if (c.reading) {
      const dir = c.dir || 'above'; const nx = norm4(c.bands); const r = C.readingOf(c.reading) || cat.sensors.find((s) => s.name === c.reading) || {};
      const err = validateBands(nx, dir, r.valid ? { kind: r.kind, valid: r.valid, unit: r.unit, name: c.reading } : null); if (err) return { ok: false, error: err };
      const cur = libBands(cat.type, c.reading, dir, false) || norm4(null); const k = `${c.reading}|${dir}`;
      if (BANDS.every((b) => same(cur[b], nx[b]))) delete dr.limits[k]; else dr.limits[k] = nx;
    }
    if (c.schedule) { const ts = libSchedFor(cat.type, c.schedule); if (!ts) return { ok: false, error: 'No such task in the library for this type.' }; const ev = c.every && c.every.n ? { n: Math.round(+c.every.n), unit: c.every.unit } : null; if (!ev || !C.UNIT_HOURS[ev.unit]) return { ok: false, error: 'Give how often: a number and a unit.' }; if (sameEvery(libEveryOf(ts), ev)) delete dr.schedules[c.schedule]; else dr.schedules[c.schedule] = ev; }
    if (c.alert) { const ta = (setOf(cat.type) || { alerts: [] }).alerts.find((a) => a.name === c.alert); if (!ta) return { ok: false, error: 'No such alert in the library for this type.' }; const x = dr.alerts[c.alert] || {}; ['hold', 'clear'].forEach((w) => { if (c[w] == null) return; const n = Math.round(+c[w]); if (same(n, libTiming(cat.type, ta.sensorKind, ta.direction, w))) delete x[w]; else x[w] = n; }); if (Object.keys(x).length) dr.alerts[c.alert] = x; else delete dr.alerts[c.alert]; }
    if (!Object.keys(dr.limits).length && !Object.keys(dr.schedules).length && !Object.keys(dr.alerts).length) delete S.lib.drafts[code]; else { dr.at = now(); S.lib.drafts[code] = dr; }
    touch(); persist(); return { ok: true, draft: libDraft(code) };
  }
  function discardDraft(code) { if (!S.lib.drafts[code]) return { ok: true, already: true }; delete S.lib.drafts[code]; touch(); persist(); return { ok: true }; }
  function whereItLands(code) {
    const dr = S.lib.drafts[code]; if (!dr) return null;
    return cached(`wil:${code}`, () => {
      const diffs = draftDiffs(dr); const kind = diffs.some((x) => x.safety) ? 'safety' : 'normal'; const typeName = dr.typeName; const plantsOut = [];
      ORDER.forEach((key) => {
        const d = dOf(key); if (!d) return; const P = PS(key); const res = { key, name: plantName(key), state: P.state, follows: [], changedHere: [], fromForm: [], openIssues: 0, dueNow: [], dueSooner: [], recount: [] };
        const eqs = d.equipment.filter((e) => e.type === typeName); if (!eqs.length) return;
        eqs.forEach((e) => {
          Object.keys(dr.limits).forEach((k) => {
            const [reading, dir] = k.split('|'); const cur = libBands(typeName, reading, dir, false) || norm4(null); const nx = norm4(dr.limits[k]);
            d.sensors.filter((s) => s.on === 'eq:' + e.id && s.name === reading && !s.nextPhase).forEach((s) => {
              const bi = bandsInfo(key, s.id, dir); const bn = bandsInfo(key, s.id, dir, { draft: true });
              BANDS.forEach((b) => {
                if (same(cur[b], nx[b])) return; const pb = bi.perBand[b]; const what = `${e.tag} · ${s.name} ${BAND_LABEL[b]} ${dirWord(dir)}`; const to = bn.perBand[b].baseValue;
                /* v7: a value changed here keeps its own value. When it was changed from the Visualization's value the library change does
                   not touch it at all (form before library, rule 8): it is listed with the form's values, never as "Library changed since" */
                if (pb.overrideId && pb.formValue != null && !(kind === 'safety' && b === 'emergency')) res.fromForm.push({ what, tag: e.tag, plantValue: fmtVal(pb.value, s.unit, s.kind), newLib: fmtVal(nx[b], s.unit, s.kind), why: bi.formWhy, changedHere: true, formValue: fmtVal(pb.formValue, s.unit, s.kind) });
                else if (pb.overrideId) { if (false && kind === 'safety' && b === 'emergency') res.follows.push({ what, tag: e.tag, from: fmtVal(pb.value, s.unit, s.kind), to: fmtVal(nx[b], s.unit, s.kind), fromValue: pb.value, toValue: nx[b], endsOverride: true, overrideId: pb.overrideId }); else res.changedHere.push({ what, tag: e.tag, plantValue: fmtVal(pb.value, s.unit, s.kind), newLib: fmtVal(nx[b], s.unit, s.kind), overrideId: pb.overrideId, baseFrom: pb.formValue != null ? 'form' : 'lib', sameAsNew: pb.formValue == null && same(pb.value, nx[b]) }); }
                else if (pb.formValue != null) res.fromForm.push({ what, tag: e.tag, plantValue: fmtVal(pb.value, s.unit, s.kind), newLib: fmtVal(nx[b], s.unit, s.kind), why: bi.formWhy });
                else if (!same(pb.value, to)) res.follows.push({ what, tag: e.tag, from: fmtVal(pb.value, s.unit, s.kind), to: fmtVal(to, s.unit, s.kind), fromValue: pb.value, toValue: to });
              });
              res.openIssues += P.issues.filter((i) => i.status !== 'closed' && i.sensorId === s.id && i.terms && i.terms.dir === dir).length;
            });
          });
          Object.keys(dr.schedules).forEach((name) => {
            d.schedules.filter((sc) => sc.subject.id === e.id && sc.name === name && sc.status !== 'off').forEach((sc) => {
              /* v7: the whole "how often" on both sides ("every 6 months or 500 run-hours → every 3 months or 500 run-hours") */
              const ci = cadenceInfo(key, sc.id); const nx = dr.schedules[name]; const what = `${name} on ${e.tag}`;
              if (ci.overrideId) { res.changedHere.push({ what, tag: e.tag, plantValue: C.every(sc), newLib: everyWith(libSchedFor(typeName, name), nx), overrideId: ci.overrideId, sameAsNew: sameEvery(ci.value, nx) }); return; }
              res.follows.push({ what, tag: e.tag, from: C.every(sc), to: everyWith(sc, nx) });
              /* v7: the due dates come from the same rule publish applies (dueAfterChange); publish uses these very numbers */
              if (P.state === 'live' && sc.status === 'active') {
                const tid = taskIdOfSchedule(key, sc.id); const st = tid ? P.tasks[tid] : null; if (!st || res.recount.some((x) => x.taskId === tid) || res.dueNow.some((x) => x.taskId === tid)) return;
                const nd = dueAfterChange(key, { ...sc, every: { ...nx } }, sc, st, now()); const already = st.due != null && st.due <= now();
                if (st.lastDone != null && nd.due <= now() && !already) res.dueNow.push({ task: what, taskId: tid, why: `last done ${fmtDay(st.lastDone)}; ${everyWith(sc, nx)} makes it due now` });
                else if (st.status === 'upcoming') {
                  res.recount.push({ taskId: tid, due: nd.due, calDue: nd.calDue });
                  /* never done since go live: the new interval counts from today, so a due date further out comes in */
                  if (st.lastDone == null && st.due != null && nd.due < st.due) res.dueSooner.push({ task: what, taskId: tid, from: fmtDay(st.due), to: fmtDay(nd.due), dueAt: nd.due, why: `not done yet; counts from today: due ${fmtDay(nd.due)} (was ${fmtDay(st.due)})` });
                }
              }
            });
          });
          Object.keys(dr.alerts).forEach((name) => {
            const a = d.alerts.find((x) => x.subject && x.subject.id === e.id && x.name === `${name} — ${e.tag}`); if (!a) return;
            ['hold', 'clear'].forEach((w) => { if (dr.alerts[name][w] == null) return; const ti = timingInfo(key, a.id, w); const what = `${a.name} · must ${w} for`; if (ti.overrideId) res.changedHere.push({ what, tag: e.tag, plantValue: `${ti.value} min`, newLib: `${dr.alerts[name][w]} min`, overrideId: ti.overrideId, sameAsNew: same(ti.value, dr.alerts[name][w]) }); else if (!same(ti.value, dr.alerts[name][w])) res.follows.push({ what, tag: e.tag, from: `${ti.value} min`, to: `${dr.alerts[name][w]} min` }); });
          });
        });
        plantsOut.push(res);
      });
      const reached = plantsOut.filter((p) => p.follows.length).length; const values = plantsOut.reduce((n, p) => n + p.follows.length, 0); const keepN = plantsOut.filter((p) => p.changedHere.length).length;
      /* v7: count kept VALUES (not plants): one plant can both follow (AT-2) and keep its own value (AT-1) */
      const keptValues = plantsOut.reduce((n, p) => n + p.changedHere.length, 0);
      const tagsOf = (list) => { const t = [...new Set(list.map((x) => x.tag).filter(Boolean))]; return t.length && t.length <= 3 ? ` (${t.join(', ')})` : ''; };
      const allFollow = [].concat(...plantsOut.map((p) => p.follows)); const allKept = [].concat(...plantsOut.map((p) => p.changedHere));
      const totals = { plants: reached, values, keep: keepN, keptValues, fromForm: plantsOut.reduce((n, p) => n + p.fromForm.length, 0), openIssues: plantsOut.reduce((n, p) => n + p.openIssues, 0), dueNow: plantsOut.reduce((n, p) => n + p.dueNow.length, 0), dueSooner: plantsOut.reduce((n, p) => n + p.dueSooner.length, 0) };
      /* v7: a kept value that equals the new library value says so ("1 value kept here, now the same as the library (AT-1)") */
      const keptSame = allKept.filter((x) => x.sameAsNew).length; const sameText = !keptSame ? '' : keptSame === keptValues ? ', now the same as the library' : `, ${keptSame} now the same as the library`;
      const text = `Reaches ${plural(reached, 'plant')} · ${plural(values, 'value')} change${values === 1 ? 's' : ''}${tagsOf(allFollow)}${keptValues ? ` · ${plural(keptValues, 'value')} kept here${sameText}${tagsOf(allKept)}` : ''}`;
      return { code, typeName, version: libVersion(code), nextVersion: libVersion(code) + 1, diffs, kind, kindText: kind === 'safety' ? 'Safety change — needs a reason; plants that changed it keep their value' : 'Plants that changed it keep their value', needsReason: kind === 'safety', plants: plantsOut, totals, text, sample: false };
    });
  }
  function publish(code, opts) {
    const o = opts || {}; const wl = whereItLands(code); if (!wl) return { ok: false, error: 'Nothing to publish: there is no draft.' };
    if (!String(o.note || '').trim()) return { ok: false, error: 'Write a change note: the plants read it in their Activity.' };
    if (wl.needsReason && !String(o.reason || '').trim()) return { ok: false, error: 'A safety change needs a reason.' };
    const dr = S.lib.drafts[code]; const t = now(); const set = setOf(dr.typeName); const version = libVersion(code) + 1; const diffs = wl.diffs;
    if (set) {
      /* the default "must hold for" depends on whether an Emergency band exists: pin it first so a limits change never moves it silently */
      Object.keys(dr.limits).forEach((k) => { const [reading, dir] = k.split('|'); const ta = set.alerts.find((a) => a.sensorKind === reading && a.direction === dir); if (ta && ta.hold == null) ta.hold = libTiming(dr.typeName, reading, dir, 'hold'); if (ta) ta.limits = sparse(dr.limits[k]); else set.alerts.push({ name: `${reading === 'Dissolved oxygen' ? 'DO' : reading} ${dir === 'below' ? 'low' : 'high'}`, sensorKind: reading, direction: dir, limits: sparse(dr.limits[k]) }); });
      Object.keys(dr.schedules).forEach((name) => { const ts = set.schedules.find((x) => x.name === name); if (ts) { ts.every = { ...dr.schedules[name] }; } });
      Object.keys(dr.alerts).forEach((name) => { const ta = set.alerts.find((a) => a.name === name); if (ta) Object.assign(ta, dr.alerts[name]); });
    }
    S.lib.versions[code] = version; delete S.lib.drafts[code]; touch();
    const reachedKeys = [];
    wl.plants.forEach((p) => {
      const key = p.key; const d = dOf(key);
      if (wl.kind === 'safety') p.follows.filter((x) => x.endsOverride && x.overrideId).forEach((x) => { const ov = S.overrides.find((y) => y.id === x.overrideId); if (ov && !ov.endedAt) endOverride(ov, `Ended by a safety change in the library (${dr.typeName} v${version}): ${o.reason}`, t); });
      d.equipment.filter((e) => e.type === dr.typeName).forEach((e) => syncEquipment(key, e.id));
      if (p.dueNow.length) p.dueNow.forEach((x) => { const st = PS(key).tasks[x.taskId]; if (st) { st.due = t; st.status = 'due'; } });
      /* v7: the due dates Where it lands showed are the ones set (one rule: dueAfterChange) */
      (p.recount || []).forEach((x) => { const st = PS(key).tasks[x.taskId]; if (!st || st.status !== 'upcoming') return; st.due = x.due; if (x.calDue != null) st.calDue = x.calDue; if (st.due <= t) st.status = 'due'; });
      /* a plant whose only items were set from its Visualization is not reached: nothing there changes, so it gets no note */
      if (p.follows.length || p.changedHere.length || p.dueNow.length) {
        reachedKeys.push(key);
        const ended = p.follows.filter((x) => x.endsOverride);
        const keptDiff = p.changedHere.filter((x) => !x.sameAsNew).length, keptSame = p.changedHere.length - keptDiff;
        const bits = [p.follows.length ? `${plural(p.follows.length, 'value')} changed` : '', keptDiff ? `${plural(keptDiff, 'value')} kept here (Library changed since)` : '', keptSame ? `${plural(keptSame, 'value')} kept here, now the same as the library` : '', p.dueNow.length ? `${plural(p.dueNow.length, 'task')} due now` : '', p.dueSooner.length ? `${plural(p.dueSooner.length, 'task')} due sooner${p.dueSooner.length <= 2 ? ` (${p.dueSooner.map((x) => `${x.task}: ${x.to}`).join('; ')})` : ''}` : ''].filter(Boolean).join(' · ');
        /* v7: a safety change says whose own value it ended, and why */
        const endedText = wl.kind === 'safety' && ended.length ? ` · ${[...new Set(ended.map((x) => x.tag).filter(Boolean))].join(', ') || 'this plant'}'s own value ended (safety change: ${o.reason})` : '';
        addActivity(t, key, `Library: ${dr.typeName} v${version} published${bits ? ` — ${bits}` : ''}${endedText}. ${o.note}`, 'library');
      }
    });
    const text = diffs.map((x) => x.text).join('; ');
    const change = { id: nextId('lc'), code, typeName: dr.typeName, version, at: t, note: o.note, reason: o.reason || null, kind: wl.kind, diffs, plants: reachedKeys, text, who: ME };
    S.lib.changes.unshift(change); addActivity(t, null, `Published ${dr.typeName} v${version} (${wl.kind === 'safety' ? 'safety change' : 'library change'}): ${text}. ${o.note}`, 'library');
    touch(); persist(); return { ok: true, version, change, landed: wl };
  }

  /* ── the clock ─────────────────────────────────────────────────────────────────────────────── */
  function expireOverrides(toT, out) {
    S.overrides.filter((o) => !o.endedAt && o.reason === 'fornow' && o.until != null && o.until <= toT).forEach((o) => {
      const key = o.plant; endOverride(o, 'The "for now" date came: back to the library', o.until); const t = o.target;
      const scOld = t.scheduleId && (t.kind === 'cadence' || t.kind === 'runhours') ? clone(schedRaw(key, t.scheduleId) || null) : null;
      if (t.sensorId) syncSensor(key, t.sensorId); if (t.alertId && (t.kind === 'hold' || t.kind === 'clear')) syncAlert(key, t.alertId); if (t.kind === 'cadence') syncSched(key, t.scheduleId); if (t.kind === 'runhours') syncRunHours(key, t.scheduleId); if (t.kind === 'tier') syncTier(key, t.eqId);
      if (scOld) recountTask(key, t.scheduleId, scOld);
      { const dd = ovDecorate(key, o); addActivity(o.until, key, `Back to the ${dd.baseFrom === 'form' ? 'Visualization' : 'library'} value on its date: ${dd.what}`, 'config', null); } if (out) out.expired.push(o.id);
    });
  }
  function advance(minutes) {
    const m = Math.round(Number(minutes) || 0); const out = { from: now(), to: now(), opened: [], closed: [], trial: [], tasksDue: [], expired: [], trialEnded: [], summary: '' };
    if (m <= 0) { out.summary = 'The clock did not move.'; return out; }
    const toT = now() + m * MIN; out.to = toT; touch();
    /* v7: split the run at every moment inside the window where the terms change (a 7-day trial ends, a "For now" date comes):
       the engine runs up to that moment with the old terms, the change applies at that moment, then the engine carries on */
    const endTrials = (at) => ORDER.forEach((key) => {
      const P = PS(key); if (!P || P.state !== 'live') return;
      Object.keys(P.alerts).forEach((id) => { const st = P.alerts[id]; if (st.state === 'trial' && st.trialUntil != null && st.trialUntil <= at) { const u = st.trialUntil; putAlertState(key, id, 'on', u); out.trialEnded.push(id); const a = alertRaw(key, id); addActivity(u, key, `${a ? a.name : id}: 7-day trial over, now On`, 'config', null); } });
    });
    const marks = () => { const xs = []; S.overrides.forEach((o) => { if (!o.endedAt && o.reason === 'fornow' && o.until != null && o.until > now() && o.until <= toT) xs.push(o.until); }); ORDER.forEach((key) => { const P = PS(key); if (!P || P.state !== 'live') return; Object.values(P.alerts).forEach((st) => { if (st.state === 'trial' && st.trialUntil != null && st.trialUntil > now() && st.trialUntil <= toT) xs.push(st.trialUntil); }); }); return xs.sort((a, b) => a - b); };
    expireOverrides(now(), out); endTrials(now()); touch();
    for (let guard = 0; guard < 500; guard++) {
      const next = marks()[0]; if (next == null) break;
      ORDER.forEach((key) => { if (!PS(key) || !dOf(key)) return; runEngine(key, next, out); });
      S.now = next; touch(); expireOverrides(next, out); endTrials(next); touch();
    }
    ORDER.forEach((key) => { if (!PS(key) || !dOf(key)) return; runEngine(key, toT, out); });
    S.now = toT; touch();
    ORDER.forEach((key) => { const P = PS(key); if (!P) return; dueTasks(key, toT, out); });
    syncClocks(); touch();
    const span = m % 1440 === 0 ? plural(m / 1440, 'day') : m % 60 === 0 ? plural(m / 60, 'hour') : plural(m, 'minute');
    const bits = [out.opened.length ? `${plural(out.opened.length, 'issue')} opened` : '', out.closed.length ? `${out.closed.length} closed` : '', out.trial.length ? `${plural(out.trial.length, 'trial firing')}` : '', out.tasksDue.length ? `${plural(out.tasksDue.length, 'task')} due` : '', out.expired.length ? `${plural(out.expired.length, 'change')} back to the library` : ''].filter(Boolean);
    out.summary = `Moved on ${span} to ${fmt(toT)}${bits.length ? ': ' + bits.join(', ') : ': nothing new'}.`;
    persist(); return out;
  }

  /* ── seeding the story ────────────────────────────────────────────────────────────────── */
  function freshState() { return { v: OVERLAY_V, story: STORY, lib6: libPrint(), now: NOW0, seq: 0, aseq: 0, plants: {}, overrides: [], lib: { versions: {}, drafts: {}, changes: [], suggestions: [] }, activity: [] }; }
  function plantState(key) { const m = PLANT_META[key]; return { key, state: m.state, since: m.since, sample: m.sample, realLayout: m.realLayout, scadaReadAt: m.since, scada: { accepted: {} }, decisions: {}, alerts: {}, eng: {}, engineAt: NOW0, issues: [], tasks: {}, mat: {}, returned: [], goLiveAt: m.state === 'live' ? m.since : null, lineWork: (LINE_WORK_SEED[key] || []).map((x) => ({ ...x })) }; }
  function importDifferences(key) {
    const d = dOf(key);
    withPlant(key, () => d.equipment.forEach((e) => C.ensureForm(e)));
    d.sensors.filter((s) => !s.nextPhase && homeOf(key, s)).forEach((s) => {
      const e = homeOf(key, s); const inPlace = {};
      if (s.direction && hasAny(s.limits)) inPlace[s.direction] = norm4(s.limits);
      d.alerts.filter((a) => a.sensor === s.id && a.limits === 'custom').forEach((a) => { inPlace[a.direction] = norm4(a.custom); });
      Object.keys(inPlace).forEach((dir) => {
        const lib = libBands(e.type, s.name, dir, false); const fs = formSet(key, e, s.name, dir); const ip = inPlace[dir];
        if (!lib && !fs) { addOverride(key, { kind: 'reading', sensorId: s.id, dir }, ip, null, { reason: 'notinlib', note: '', author: null, reviewBy: null }, null); return; }
        BANDS.forEach((b) => { const base = fs && fs.lim[b] != null ? fs.lim[b] : lib ? lib[b] : null; if (!same(ip[b], base)) addOverride(key, { kind: 'limit', sensorId: s.id, dir, band: b }, ip[b], base, { reason: 'unrecorded', note: '', author: null, reviewBy: null }, null); });
      });
    });
    touch();
    d.alerts.forEach((a) => {
      const s = sensorRaw(key, a.sensor); const e = alertEq(key, a); if (!s || !e || s.nextPhase) return; const dir = alertDir(key, a);
      if (!libAlertFor(e.type, s.name, dir)) { addOverride(key, { kind: 'alert', alertId: a.id }, a.name, null, { reason: 'notinlib', note: '', author: null, reviewBy: null }, null); return; }
      const lh = libTiming(e.type, s.name, dir, 'hold'), lc = libTiming(e.type, s.name, dir, 'clear');
      if (a.holdMin != null && !same(a.holdMin, lh)) addOverride(key, { kind: 'hold', alertId: a.id }, a.holdMin, lh, { reason: 'unrecorded', note: '', author: null, reviewBy: null }, null);
      if (a.closes && a.closes.mode === 'sensor' && a.closes.holdMin != null && !same(a.closes.holdMin, lc)) addOverride(key, { kind: 'clear', alertId: a.id }, a.closes.holdMin, lc, { reason: 'unrecorded', note: '', author: null, reviewBy: null }, null);
    });
    importScheduleDifferences(key);
    d.equipment.forEach((e) => { const cat = catByType(e.type); if (cat && cat.tier !== e.tier) addOverride(key, { kind: 'tier', eqId: e.id }, e.tier, cat.tier, e.tierReason ? { reason: 'tuned', note: e.tierReason, author: key === 'manesar' ? 'Sunny Verma' : null, reviewBy: T('2026-10-26T09:00') } : { reason: 'unrecorded', note: '', author: null, reviewBy: null }, e.tierReason && key === 'manesar' ? T('2026-09-26T14:30') : null); });
    touch();
  }
  /* v7: a task's cadence against the library, else the Visualization (rule 8); only a task neither has is "Not in the library" */
  function importScheduleDifferences(key) {
    dOf(key).schedules.forEach((sc) => {
      if (ovCadence(key, sc.id)) return;
      const base = libEveryForSched(key, sc, false) || formEveryForSched(key, sc); const cur = C.cadenceOf(sc);
      if (!base) addOverride(key, { kind: 'cadence', scheduleId: sc.id }, cur, null, { reason: 'notinlib', note: '', author: null, reviewBy: null }, null);
      else if (!sameEvery(base, sc.every && sc.every.n ? sc.every : base)) addOverride(key, { kind: 'cadence', scheduleId: sc.id }, sc.every, base, { reason: 'unrecorded', note: '', author: null, reviewBy: null }, null);
    });
    touch();
  }
  function seedLive(key) {
    const P = PS(key); const d = dOf(key);
    withPlant(key, () => C.typeGroups()).forEach((g) => { P.scada.accepted[g.type] = P.since; });
    d.alerts.forEach((a) => { const s = sensorRaw(key, a.sensor); const st = a.status === 'draft' ? 'draft' : a.status === 'off' || (s && s.nextPhase) ? 'off' : 'on'; P.alerts[a.id] = { state: st, since: P.since, trialSince: null }; });
    importDifferences(key);
    touch(); ensureTaskStates(key, 'seed');
    addActivity(P.since, key, `Went live`, 'golive', null);
  }
  /* Live history: the engine runs over the last 30 days; people closed what it opened (short firings as false alarms). */
  function seedHistory(key) {
    const P = PS(key); P.engineAt = lastPollAtOrBefore(NOW0 - 30 * DAY); P.eng = {}; const sink = { opened: [], closed: [], trial: [], tasksDue: [] };
    runEngine(key, NOW0, sink, { quiet: true });
    const ops = dOf(key).people.filter((p) => p.role === 'l1'); const leads = dOf(key).people.filter((p) => p.role === 'l3');
    /* v7: condition-based work the lines raised: the Operator did what was raised more than 12 hours ago, a few hours later */
    lineWorkOf(key).forEach((lw) => {
      const st = P.tasks[lw.id]; if (!st || st.status !== 'due' || st.raisedAt == null) return; const s = sensorRaw(key, lw.sensorId); const e = s ? homeOf(key, s) : null;
      addActivity(st.raisedAt, key, `Task raised: ${lw.name}, ${e ? e.tag + ' ' : ''}${s ? said(s, st.raisedBy.value) : ''} (${BAND_LABEL[lw.band]} line)`, 'task', null);
      if (st.raisedAt > NOW0 - 12 * HOUR) return;
      const h = mix(h32(lw.id + st.raisedAt), 7); const at = Math.round((st.raisedAt + (2 + 6 * h) * HOUR) / MIN) * MIN; const who = ops[Math.floor(h * 10) % Math.max(1, ops.length)];
      st.history.push({ due: st.raisedAt, done: at, late: false, raisedBy: st.raisedBy, by: who ? who.name : null });
      Object.assign(st, { lastDone: at, due: null, status: 'armed', raisedAt: null, raisedBy: null });
      addActivity(at, key, `Task done: ${lw.name}`, 'task', who ? who.name : null);
    });
    /* v7: Activity lists every seeded issue's opening and closing (who closed it, false alarm where it was one), like the Issues tab */
    P.issues.forEach((iss) => {
      const opened = () => addActivity(iss.opened, key, `Issue opened: ${iss.title} at ${BAND_LABEL[iss.band]}`, 'issue', null);
      const byReading = () => { if (iss.status === 'closed' && iss.closed != null) addActivity(iss.closed, key, `Issue closed: ${iss.title} (the reading came back)`, 'issue', null); };
      if (iss.opened > NOW0 - 12 * HOUR) { opened(); byReading(); return; }
      const h = mix(h32(iss.id), 7); const fa = !!iss.short; const start = iss.cleared != null ? iss.cleared : iss.opened + HOUR; const at = Math.round((start + (fa ? 0.5 + 1.5 * h : 2 + 8 * h) * HOUR) / MIN) * MIN;
      if (at > NOW0 - HOUR) { opened(); byReading(); return; } const who = (fa ? ops : leads)[Math.floor(h * 10) % Math.max(1, (fa ? ops : leads).length)]; const name = who ? who.name : 'the Lead';
      iss.log = iss.log.filter((x) => !/^Closed by the reading/.test(x.text)); iss.status = 'closed'; iss.closed = at; iss.falseAlarm = fa; iss.closedHow = fa ? 'false alarm' : 'fixed';
      if (!fa) { const f = libFlow(iss.diag.flowId); const causes = f ? [...new Set(f.steps.flatMap((st) => Object.values(st.answers || {}).filter((x) => x.t === 'cause').map((x) => x.id)))].map(causeOf).filter((c) => c && !c.sensorFault && !c.noFault) : []; const c = causes.length ? causes[Math.floor(h * causes.length)] : null; if (c) { iss.diag.causeId = c.id; ilog(iss, at - 30 * MIN, `Root cause: ${c.name}`); } ilog(iss, at, `Fixed and closed by ${name}`); }
      else ilog(iss, at, `Closed as a false alarm by ${name}: the reading came back by itself`);
      opened(); addActivity(at, key, `Issue closed: ${iss.title}${fa ? ' (false alarm)' : ''}`, 'issue', name);
    });
  }
  /* v7: the Operator who was told started the diagnosis of the open DO issue at 07:50 ("Is the blower running?" Yes), so the presenter
     continues at question 2, the log shows who started it, and the reading coming back cannot close it as unstarted before chapter 8 */
  function seedStartedDiagnosis(key) {
    const P = PS(key); const iss = P.issues.find((i) => i.alertId === 'a_do_at2' && i.status === 'open'); if (!iss) return;
    const f = libFlow(iss.diag.flowId); const st = f && f.steps[0]; const yes = st && st.answers && st.answers.Yes; if (!yes) return;
    const told = (p) => iss.told.some((x) => x.who === p.name); const ppl = dOf(key).people;
    const op = ppl.find((p) => p.name === 'Dheeraj Kumar' && told(p)) || ppl.find((p) => p.role === 'l1' && told(p)); if (!op) return;
    const at = iss.opened + 10 * MIN; const text = String(st.text || '').replace(/[.\s]+$/, '');
    iss.status = 'diagnosing'; iss.diag.path.push({ stepId: st.id, answer: 'Yes', at, next: yes.t === 'step' ? yes.id : null, by: op.name });
    ilog(iss, at, `Diagnosis started by ${op.name} (${ROLE[op.role] || op.role})`); ilog(iss, at, `${text}: Yes`);
    iss.log.sort((a, b) => a.at - b.at);
    addActivity(at, key, `Diagnosis started on ${iss.title}: ${text} Yes`, 'issue', op.name);
  }
  function seedVedanta() {
    const key = 'vedanta'; const P = PS(key); const d = dOf(key);
    if (!d.people.some((p) => (p.role === 'l3' || p.role === 'l4') && p.phone && p.phone.verified)) d.people.push({ id: 'pv3', name: 'Arjun Mehta', role: 'l3', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '22:00–06:00' });
    addActivity(P.since, key, `Commissioning started: The Visualization read, ${plural(d.equipment.length, 'piece', 'pieces')} of equipment of ${plural(withPlant(key, () => C.typeGroups()).length, 'type')}`, 'scada', null);
    const tAcc = T('2026-10-23T10:25'), tLib = T('2026-10-23T10:55'), tOv = T('2026-10-23T11:30');
    S.now = tAcc; acceptAllScada(key);
    S.now = tLib; const keepOpen = (p) => p.name === 'MLSS low' && p.tag === 'SBR-1';
    const rows = libraryReview(key); let n = 0; rows.forEach((r) => r.proposals.forEach((p) => { if (p.blockedBy || p.decided || keepOpen(p)) return; if (decide(key, p.pid, 'accept', { quiet: true, noSave: true, at: tLib }).ok) n++; }));
    rows.forEach((r) => { if (r.proposals.some(keepOpen)) materialize(key, r.eqId, tLib); });
    addActivity(tLib, key, `Accepted what the library brings: ${plural(n, 'proposal')}; MLSS low on SBR-1 left to decide while the biology settles. Alerts go On trial`, 'config');
    S.now = tOv; const ph = d.sensors.find((s) => s.id === 'v_eq1_PH');
    if (ph) { const r = setLimits(key, ph.id, 'below', { ...bandsInfo(key, ph.id, 'below').bands, emergency: 4.0 }, { reason: 'tuned', note: 'Acid from the pickling line can reach EQ-1; the Leads must know at once' }); if (!r.ok) throw new Error('seed: ' + r.error); }
    /* v7: like Manesar and Bawal, every task the library and the Visualization do not have is listed in Differences */
    importScheduleDifferences(key);
    S.now = NOW0; P.engineAt = lastPollAtOrBefore(tLib); P.eng = {}; touch();
    runEngine(key, NOW0, { opened: [], closed: [], trial: [], tasksDue: [] });
  }
  /* v7: v6's audit lines in v7's words (no "Override", no letter codes, no state words v7 does not have, no versions on flows) */
  function auditWords(a) {
    const TL = C.TIER_LABEL || {}; let what = a.what, detail = a.detail || '', kind = 'config';
    let m = /^Overrode criticality on (.+)$/.exec(what);
    if (m) { const e = dOf('manesar').equipment.find((x) => x.name === m[1]); const dm = /^([ABC]) → ([ABC]):?\s*(.*)$/.exec(detail); what = `Changed criticality of ${e ? e.tag : m[1]}${dm ? `: ${TL[dm[1]] || dm[1]} → ${TL[dm[2]] || dm[2]}` : ''}`; detail = dm ? dm[3] : detail; }
    m = /^Activated alert (.+)$/.exec(what); if (m) what = `Turned on ${m[1]}`;
    m = /^Published (.+?) v\d+$/.exec(what); if (m) { what = `Updated the ${m[1]} steps`; kind = 'library'; }
    what = what.replace(/ from the equipment card$/, '');
    m = /^Changed (.+) on (\S+)$/.exec(what); if (m && !/^limits /.test(m[1]) && /run-hours|every/i.test(detail)) what = `Changed how often ${m[1]} on ${m[2]} runs`;
    return { what, detail, kind };
  }
  function seedStory() {
    S = freshState(); profiles.clear(); touch();
    C.clearStore(); C.seedEstate();
    ORDER.forEach((key) => { S.plants[key] = plantState(key); const d = dOf(key); d.rt = { records: [], messages: [], offset: rtOffset(NOW0) }; d.alerts.forEach((a) => { a.open = 0; }); d.schedules.forEach((x) => { x.open = 0; }); d.conditionWork.forEach((w) => { w.open = 0; }); });
    touch();
    /* Manesar: v6's audit lines become its Activity */
    (dOf('manesar').audit || []).forEach((a) => { const at = Date.parse(a.ts.replace(' ', 'T') + ':00+05:30'); if (Number.isFinite(at) && at < NOW0) { const x = auditWords(a); addActivity(at, 'manesar', `${x.what}${x.detail ? ` · ${x.detail}` : ''}`, x.kind, a.who); } });
    seedLive('manesar'); seedLive('bawal');
    /* the library already has a little history: Clarifier Tank v2 (20 Oct) raised "must hold for" on Sludge blanket high. Manesar had
       its own value before, so its difference now shows "Library changed since". */
    S.now = T('2026-10-20T11:00');
    if (editLib('CLARIFIER', { alert: 'Sludge blanket high', hold: 15 }).ok) publish('CLARIFIER', { note: 'Blanket readings bounce while the scraper passes; 15 min stops false starts' });
    S.now = NOW0; touch();
    seedHistory('manesar'); seedHistory('bawal'); seedStartedDiagnosis('manesar');
    seedVedanta();
    addActivity(PLANT_META.digitalpaani.since, 'digitalpaani', `The Visualization read: ${dOf('digitalpaani').equipment.length} pieces of equipment of ${withPlant('digitalpaani', () => C.typeGroups()).length} types, from the real layout. Nothing reviewed yet`, 'scada', null);
    S.now = NOW0; ORDER.forEach((k) => { PS(k).engineAt = lastPollAtOrBefore(NOW0); }); syncClocks(); touch();
  }

  /* ── life ──────────────────────────────────────────────────────────────────────────────────── */
  /* v7: work out what an action would do on the real data, then put the plant, the ledger, the library and the log back as they were
     (nothing is saved while it runs) */
  let DRY = 0; const LIB_LINKS = ['standardSets', 'flows', 'causes'];
  function dryRun(key, fn) {
    const d = dOf(key); const keys = Object.keys(d).filter((k) => !LIB_LINKS.includes(k)); const snapD = clone(Object.fromEntries(keys.map((k) => [k, d[k]])));
    const snapS = clone({ plant: S.plants[key], overrides: S.overrides, lib: S.lib, seq: S.seq, aseq: S.aseq, now: S.now }); const nAct = S.activity.length;
    DRY++;
    try { return fn(); } finally {
      DRY--; Object.keys(d).filter((k) => !LIB_LINKS.includes(k)).forEach((k) => { delete d[k]; }); Object.assign(d, snapD);
      Object.assign(S, { overrides: snapS.overrides, lib: snapS.lib, seq: snapS.seq, aseq: snapS.aseq, now: snapS.now }); S.plants[key] = snapS.plant; S.activity.length = nAct; touch();
    }
  }
  function persist() { if (!S || DRY) return false; try { S.saves = (S.saves || 0) + 1; window.CTL_STAMP = `${S.story}:${S.saves}`; C.persist(true); localStorage.setItem(OVERLAY, JSON.stringify(S)); return true; } catch (e) { return false; } }
  function restoreAll() {
    try {
      const raw = localStorage.getItem(OVERLAY); if (!raw) return false; const o = JSON.parse(raw);
      if (!o || o.v !== OVERLAY_V || o.story !== STORY || o.lib6 !== libPrint() || !o.plants) return false;
      if (!C.restore()) return false; if (!ORDER.every((k) => C.S.plants[k] && o.plants[k])) return false;
      if (C.S.stamp !== `${o.story}:${o.saves}`) return false;   /* the two saves were not written together */
      S = o; profiles.clear(); touch(); syncClocks(); return true;
    } catch (e) { return false; }
  }
  function reset() { seedStory(); touch(); persist(); return S; }
  function boot() { if (!restoreAll()) reset(); return S; }

  const api = {
    boot, reset, persist,
    now, fmt, fmtDay, fmtDate, fmtTime, fmtDur, advance,
    plants, plant, state, trialStart, withPlant, equipment, eq, sensors, readings, alerts, alert, schedules, people, addSamplePeople,
    series, latest, replay, previewLimits, trialStats, isNoisy,
    alertState, setAlertState,
    limitsOf, dirs: dirsOf, libLimits, sourceOf, setLimits, setAlertTiming, setCadence, setTier,
    overrides, revert, revertAll, revertPreview, keep, suggest, suggestions,
    scadaReview, acceptScadaGroup, acceptAllScada, autoSetup, libraryReview, decide, acceptAllFor, acceptAllPreview,
    checklist, noLimitsYet, eachOf, goLivePreview, goLive, returnToCommissioning,
    issues, issue, tasks, task, report, answer, chooseCause, diagStep, startFix, fixStep, verify, close, startTask, doTaskStep, doneTask, setLastDone,
    flowOf, diagFor, causeOf, fixFlowFor, linkedTask, taskForGeneral, issueTypes, issueTerms, reportSensorFault, causesFor,
    taskGroups, tasksPerDay, workLevel, setWorkLevel, coverage, lineWork, setLineWork, setAlertFlow, structure: (key) => structOf(key), addUnitProcess, setUnitProcess, removeUnitProcess, placeEquipment, saveControlGroup, removeControlGroup, unitProcess: upOf, controlGroupOf: cgOfEq,
    libTypes, libType, libVersion, libDraft, editLib, discardDraft, whereItLands, publish,
    activity, log,
    LABELS, BANDS, fmtVal, limitsText, sevClock, bandLabel: (b) => BAND_LABEL[b] || '', everyText, plantName,
    NOW0, POLL,
  };
  Object.defineProperty(api, 'S', { get: () => S, enumerable: true });
  return api;
})();
