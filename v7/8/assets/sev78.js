/* v7/7 and v7/8 · sev78.js — severity timelines: what happens when an issue stays open.
   An issue's severity sets two clocks, counted from when it opened, and a reminder that repeats:
     nobody has started after `start` hours · not fixed after `fix` hours · then reminded every `repeat` hours until it is fixed.
   Who is told at each step is fixed per severity. The hours are set once per severity in the library, and a plant may keep its own.
   Caution has no clock: it is shown in the app and the morning email, and never reminds.
   Criticality plays no part here: it sets the reminders on late tasks (crit78.js).

   window.V7SEV:
     lib(band) → { start, fix, repeat }      setLib(band, vals)
     plant(key, band) → { start, fix, repeat, own }      setPlant(key, band, vals | null)
     sentence(band, vals) · steps(key, issue) → the steps of one open issue with their times
   The words everywhere ("Start within 8 hours, fix within 1 day") follow the timeline, because the engine's own table reads it.
   This prototype shows each step's time on the issue; it does not play the reminders back as messages. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const C = W.CTL;
  const BANDS = ['emergency', 'major', 'minor']; const LABEL = { emergency: 'Emergency', major: 'Major', minor: 'Minor', caution: 'Caution' };
  const BASE = {}; BANDS.forEach((b) => { const c = (C && C.SEV_CLOCK && C.SEV_CLOCK[b]) || []; BASE[b] = [c[0], c[1]]; });
  const DEF = { emergency: { start: BASE.emergency[0] || 1, fix: BASE.emergency[1] || 4, repeat: 1 }, major: { start: BASE.major[0] || 8, fix: BASE.major[1] || 24, repeat: 8 }, minor: { start: BASE.minor[0] || 24, fix: BASE.minor[1] || 72, repeat: 24 } };
  const FIELDS = [['start', 'Nobody has started after'], ['fix', 'Not fixed after'], ['repeat', 'Then remind every']];
  const WHO = {
    emergency: { now: 'Everyone at the plant is called, the hooter sounds', start: 'the Lead and the Senior Lead are called again', fix: 'everyone at the plant is called again, and the Site Admin gets an email', repeat: 'the Lead and the Senior Lead are called' },
    major: { now: 'The Operator and the Lead are told, with a full-screen alarm', start: 'the Lead is told', fix: 'the Senior Lead is told, and the Site Admin and the client get an email', repeat: 'the Senior Lead is told' },
    minor: { now: 'The Operator is told, the Lead sees it in the app', start: 'the Lead is told', fix: 'the Senior Lead is told, and the Site Admin and the client get an email', repeat: 'the Senior Lead is told' },
  };
  const arr = (x) => (Array.isArray(x) ? x : []);
  const fmt = (h) => { h = +h; if (h >= 48 && h % 24 === 0) return `${h / 24} days`; if (h === 24) return '1 day'; if (h < 1) return `${Math.round(h * 60)} min`; return `${h} ${h === 1 ? 'hour' : 'hours'}`; };
  const every = (h) => (+h === 24 ? 'every day' : +h === 1 ? 'every hour' : `every ${fmt(h)}`);
  function libStore() { const L = V().S.lib; if (!L.sevTimes || typeof L.sevTimes !== 'object') L.sevTimes = {}; return L.sevTimes; }
  const plantRec = (key) => { try { return V().S.plants[key] || null; } catch (e) { return null; } };
  function plantStore(key) { const P = plantRec(key); if (!P) return {}; if (!P.sevTimes || typeof P.sevTimes !== 'object') P.sevTimes = {}; return P.sevTimes; }
  const lib = (b) => ({ ...DEF[b], ...(libStore()[b] || {}) });
  function plant(key, b) { const o = plantStore(key)[b]; return o ? { ...o, own: true } : { ...lib(b), own: false }; }
  function clean(x) {
    const out = {};
    for (const [k, label] of FIELDS) { const v = Number(x && x[k]); if (!(x && x[k] !== '' && x[k] != null) || !Number.isFinite(v) || v <= 0) return { error: `${label}: give a number of hours above 0.` }; if (v > 24 * 60) return { error: `${label}: 60 days is the most.` }; out[k] = Math.round(v * 100) / 100; }
    if (out.fix < out.start) return { error: 'The time to fix it comes after the time to start, not before.' };
    return out;
  }
  const sentence = (b, t) => (b === 'caution' ? 'Shown in the app and the morning email. No clock, and it never reminds.' : `Nobody has started in ${fmt(t.start)}: ${WHO[b].start}. Not fixed in ${fmt(t.fix)}: ${WHO[b].fix}. After that, ${WHO[b].repeat} ${every(t.repeat)} until it is fixed.`);
  const same = (a, b) => FIELDS.every(([k]) => +a[k] === +b[k]);
  function setLib(b, x) {
    if (!BANDS.includes(b)) return { ok: false, error: b === 'caution' ? 'Caution has no clock.' : 'No such severity.' }; const k = clean(x); if (k.error) return { ok: false, error: k.error };
    if (same(k, DEF[b])) delete libStore()[b]; else libStore()[b] = k;
    V().log(null, `Severity timeline, ${LABEL[b]}: ${sentence(b, k)} Every plant that follows the library has it now`, 'library'); if (V().persist) V().persist(); return { ok: true };
  }
  function setPlant(key, b, x) {
    if (!plantRec(key)) return { ok: false, error: 'No such plant.' }; if (!BANDS.includes(b)) return { ok: false, error: b === 'caution' ? 'Caution has no clock.' : 'No such severity.' }; const st = plantStore(key);
    if (x == null) { delete st[b]; V().log(key, `Severity timeline, ${LABEL[b]}: follows the library again`, 'config'); if (V().persist) V().persist(); return { ok: true }; }
    const k = clean(x); if (k.error) return { ok: false, error: k.error };
    if (same(k, lib(b))) delete st[b]; else st[b] = k;
    V().log(key, `Severity timeline, ${LABEL[b]}, for this plant: ${sentence(b, k)}`, 'config'); if (V().persist) V().persist(); return { ok: true };
  }
  /* the steps of one issue, with the time each falls due */
  function steps(key, iss) {
    if (!iss || iss.closed || iss.status === 'closed' || !BANDS.includes(iss.band) || iss.commissioning) return [];
    const t = plant(key, iss.band); const H = 3600000; const now = V().now(); const o = +iss.opened; const fixAt = o + t.fix * H; const rep = t.repeat * H;
    const started = iss.status !== 'open'; const n = now >= fixAt ? Math.floor((now - fixAt) / rep) : 0;
    return [
      { id: 'start', what: 'Nobody has started', who: WHO[iss.band].start, at: o + t.start * H, state: started ? 'skip' : now >= o + t.start * H ? 'past' : 'ahead' },
      { id: 'fix', what: 'Not fixed', who: WHO[iss.band].fix, at: fixAt, state: now >= fixAt ? 'past' : 'ahead' },
      { id: 'repeat', what: `Still not fixed, ${every(t.repeat)}`, who: WHO[iss.band].repeat, at: fixAt + (n + 1) * rep, state: 'ahead', count: n },
    ];
  }
  /* the engine's own table reads the timeline: on a plant's pages that plant's, elsewhere the library's */
  const keyNow = () => { try { const m = /^#\/p\/([^/?]+)/.exec(location.hash || ''); const k = m ? decodeURIComponent(m[1]) : null; return k && plantRec(k) ? k : null; } catch (e) { return null; } };
  if (C && C.SEV_CLOCK) BANDS.forEach((b) => { try { Object.defineProperty(C.SEV_CLOCK, b, { enumerable: true, configurable: true, get() { try { const k = keyNow(); const t = k ? plant(k, b) : lib(b); return [t.start, t.fix, t.repeat]; } catch (e) { return BASE[b].slice(); } } }); } catch (e) { /* the fixed table stays */ } });
  W.V7SEV = { BANDS, LABEL, DEF, WHO, lib, setLib, plant, setPlant, sentence, steps, fmt };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip; const enc = encodeURIComponent; const cap = (x) => String(x).charAt(0).toUpperCase() + String(x).slice(1);
  function rowsHtml(key) {
    const counts = {}; if (key) { try { arr(V().issues(key, {})).filter((i) => !i.closed && i.status !== 'closed').forEach((i) => { counts[i.band] = (counts[i.band] || 0) + 1; }); } catch (e) { /* no count */ } }
    const row = (b) => { const v = key ? plant(key, b) : lib(b); const n = counts[b] || 0;
      return `<li class="ct-row"><div class="ct-rl">${U.sev(b)}${key ? `<span class="ct-n">${n} open ${n === 1 ? 'issue' : 'issues'}</span>` : ''}</div><div class="ct-rm"><dl class="sv-lines"><div><dt>When it opens</dt><dd>${esc(WHO[b].now)}.</dd></div><div><dt>Not started in ${esc(fmt(v.start))}</dt><dd>${esc(cap(WHO[b].start))}.</dd></div><div><dt>Not fixed in ${esc(fmt(v.fix))}</dt><dd>${esc(cap(WHO[b].fix))}.</dd></div><div><dt>Then ${esc(every(v.repeat))}</dt><dd>${esc(cap(WHO[b].repeat))}, until it is fixed.</dd></div></dl></div><div class="ct-ra">${key ? (v.own ? chip('Changed here', { tone: 'warn', title: 'This plant keeps its own timeline; the library keeps its own' }) : chip('Follows the library', { tone: 'muted' })) : ''}${btn('Edit', { act: key ? 'sv:open' : 'sv:lib-open', data: key ? { plant: key, band: b } : { band: b }, small: true, title: `Change the ${LABEL[b]} timeline${key ? ' for this plant' : ' in the library'}` })}</div></li>`; };
    return BANDS.map(row).join('') + `<li class="ct-row"><div class="ct-rl">${U.sev('caution')}</div><div class="ct-rm">${esc(sentence('caution'))}</div><div class="ct-ra"></div></li>`;
  }
  let OPEN = false; const short = (get) => BANDS.map((b) => `${LABEL[b]} after ${fmt(get(b).start)}`).join(' · ');
  const fold = (line, inner) => `<details class="card p7-fold ct-card sv-card" id="sv-card"${OPEN ? ' open' : ''}><summary class="p7-fold-s"><span class="p7-fold-m"><span class="p7-fold-t">Severity timelines</span><span class="p7-fold-d">${esc(line)}</span></span></summary><div class="ct-body">${inner}</div></details>`;
  const lead = (tail) => `<p class="ct-lead">When an issue stays open: when it is chased, and who is told. Hours are counted from when the issue opened. ${tail}</p>`;
  const libCard = () => fold(`An issue nobody has started is chased: ${short(lib)}. Open to see who is told, the time to fix, and the repeat.`, `${lead('Set once for each severity. Every plant follows it unless it keeps its own.')}<ul class="ct-rows">${rowsHtml(null)}</ul>`);
  function plantCard(key) { const own = BANDS.filter((b) => plant(key, b).own).length; return fold(`An issue nobody has started is chased: ${short((b) => plant(key, b))}. ${own ? `${own} changed for this plant` : 'As the library'}. Open to change it.`, `${lead('Inherited from the library, one per severity. This plant may keep its own.')}<ul class="ct-rows">${rowsHtml(key)}</ul>`); }

  /* on an open issue: the steps ahead of it */
  function nextCard(key, iss) {
    const ss = steps(key, iss); const fmtT = (ms) => (U.fmt ? U.fmt(ms) : new Date(ms).toISOString());
    if (!ss.length) { if (iss && !iss.closed && iss.status !== 'closed' && iss.band === 'caution') return `<section class="card wk-aside sv-next" id="sv-next"><header class="card-h"><div class="card-hl"><h2 class="card-t">If it stays open</h2></div></header><div class="card-b"><p class="muted small">Caution has no clock. It stays in the app and the morning email, and nobody is reminded.</p></div></section>`; return ''; }
    const t = plant(key, iss.band); const now = V().now(); const away = (ms) => { const h = ms / 3600000; return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? fmt(Math.round(h)) : `${Math.round(h / 24)} days`; };
    const li = (s) => { const st = s.state === 'skip' ? chip('Started, so not needed', { tone: 'ok' }) : s.state === 'past' ? chip('Time passed', { tone: 'warn' }) : chip(`In ${away(s.at - now)}`, { tone: 'muted' });
      if (s.state === 'skip') return `<li class="sv-st is-skip"><div class="sv-sw"><b>${esc(s.what)}</b> ${st}</div><div class="sv-sp">Someone has started, so nobody is chased for this.</div></li>`;
      return `<li class="sv-st is-${s.state}"><div class="sv-sw"><b>${esc(s.what)}</b> ${st}</div><div class="sv-sp">${s.id === 'repeat' ? (s.count ? `Reminded ${s.count} ${s.count === 1 ? 'time' : 'times'} so far. Next ` : 'First ') : ''}${esc(fmtT(s.at))}: ${esc(s.who)}.</div></li>`; };
    return `<section class="card wk-aside sv-next" id="sv-next"><header class="card-h"><div class="card-hl"><h2 class="card-t">If it stays open</h2></div></header><div class="card-b"><ol class="sv-steps">${ss.map(li).join('')}</ol><p class="muted small">From the ${esc(LABEL[iss.band])} timeline ${t.own ? 'this plant keeps' : 'in the library'}. <a href="#/p/${esc(enc(key))}/library">Change it under Alerts &amp; Tasks</a>. This prototype shows the times; it does not send the reminders.</p></div></section>`;
  }
  W.V7SEV.nextCard = nextCard;

  let ED = null;
  function drawEd() {
    const E = ED; const f = ([k, label]) => U.field({ label: `${label} (hours)`, html: `<input type="number" min="0.25" step="0.25" id="sv-${k}" value="${esc(E.vals[k])}">` });
    U.modal({ title: `${LABEL[E.band]}: when an issue stays open${E.key ? ', at this plant' : ''}`,
      body: `<p class="la-n">Hours are counted from when the issue opened. 24 is a day.</p><div class="la-2">${f(FIELDS[0])}${f(FIELDS[1])}</div><div class="la-2">${f(FIELDS[2])}<div></div></div><ul class="ct-mini"><li><b>Nobody has started</b> ${esc(WHO[E.band].start)}.</li><li><b>Not fixed</b> ${esc(WHO[E.band].fix)}.</li><li><b>Each reminder after that</b> ${esc(WHO[E.band].repeat)}.</li></ul><p class="la-n">${E.key ? 'This changes the timeline at this plant only. The library keeps its own.' : 'Every plant that follows the library has it at once. A plant that keeps its own timeline is left alone.'} Who is told at each step comes from the User Center.</p>`,
      foot: (E.key && E.own ? btn('Back to the library\'s', { act: 'sv:reset', kind: 'ghost' }) : '') + btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(E.key ? 'Save for this plant' : 'Save', { act: E.key ? 'sv:save' : 'sv:lib-save', kind: 'primary' }) });
  }
  const opener = (el) => { const key = el.getAttribute('data-plant') || null; const b = el.getAttribute('data-band'); if (!BANDS.includes(b)) return false; const v = key ? plant(key, b) : lib(b); ED = { key, band: b, own: !!v.own, vals: { start: v.start, fix: v.fix, repeat: v.repeat } }; drawEd(); return false; };
  U.on('sv:open', opener); U.on('sv:lib-open', opener);
  const saver = () => { if (!ED) return false; const x = {}; FIELDS.forEach(([k]) => { const e = document.getElementById('sv-' + k); x[k] = e ? e.value : ''; }); const r = ED.key ? setPlant(ED.key, ED.band, x) : setLib(ED.band, x); if (!r.ok) { U.toast(r.error); return false; } const key = ED.key; ED = null; U.closeModal(true); U.toast(key ? 'Saved for this plant.' : 'Saved. Plants that follow the library have it now.'); return undefined; };
  U.on('sv:save', saver); U.on('sv:lib-save', saver);
  U.on('sv:reset', () => { if (!ED || !ED.key) return false; const r = setPlant(ED.key, ED.band, null); ED = null; U.closeModal(true); U.toast(r.ok ? 'It follows the library again.' : r.error); return undefined; });

  document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.id === 'sv-card') OPEN = d.open; }, true);
  if (U.afterRender) U.afterRender((main, path) => {
    try {
      if (!main) return; const p = String(path || location.hash).replace(/^#?\/?/, '').split('?')[0]; let m;
      const put = (html) => { if (main.querySelector('#sv-card')) return; const after = main.querySelector('#ct-card'); if (after) after.insertAdjacentHTML('afterend', html); else { const body = main.querySelector('.pg-main'); if (body) body.insertAdjacentHTML('afterbegin', html); } };
      if (p === 'library') return put(libCard());
      if ((m = /^p\/([^/]+)\/library$/.exec(p))) return put(plantCard(decodeURIComponent(m[1])));
      if ((m = /^p\/([^/]+)\/issue\/([^/]+)$/.exec(p))) {
        if (main.querySelector('#sv-next')) return; const key = decodeURIComponent(m[1]); const id = decodeURIComponent(m[2]); const iss = arr(V().issues(key, {})).find((i) => i.id === id); const html = iss ? nextCard(key, iss) : ''; if (!html) return;
        const cards = Array.prototype.slice.call(main.querySelectorAll('.wk-aside')); const told = cards.find((c) => { const h = c.querySelector('.card-t'); return h && /Who was told/.test(h.textContent || ''); });
        if (told) told.insertAdjacentHTML('afterend', html); else if (cards.length) cards[cards.length - 1].insertAdjacentHTML('afterend', html);
      }
    } catch (e) { /* the page still shows without it */ }
  });
})();
