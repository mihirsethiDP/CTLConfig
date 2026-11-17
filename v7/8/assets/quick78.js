/* v7/8 · quick78.js — Jump to: one box that goes straight to a plant, a piece of equipment, a library type, a flow or a page,
   and opens the limits of a reading without walking there. Ctrl K (or Cmd K), or the button in the top bar.
   What a person may not open under the role picker is not offered. */
(function () {
  'use strict';
  const W = window; const U = W.V7UI; if (!U || typeof document === 'undefined' || !document.body) return;
  const V = () => W.V7; const esc = U.esc; const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, d) => { try { const r = fn(); return r == null ? d : r; } catch (e) { return d; } };
  let BOX = null; let ITEMS = []; let SHOWN = []; let AT = 0;
  const enc = encodeURIComponent;
  function build() {
    const v = V(); const PZ = W.V7PERSONA; const sees = (h) => !PZ || !PZ.sees || PZ.sees(h); const all = !PZ || PZ.isAll() || (PZ.can && PZ.can('templates')); const tech = all || (PZ && PZ.can && PZ.can('tech'));
    const out = []; const add = (kind, label, hint, href, run) => { if (run || sees(href)) out.push({ kind, label, hint: hint || '', href, run: run || null, hay: `${label} ${hint || ''} ${kind}`.toLowerCase() }); };
    [['All Plants', '#/plants'], ['Library', '#/library'], ['Library, unit processes', '#/library?lib=process'], ['Flows', '#/flows'], ['Visualization', '#/visualization'], ['User Center', '#/users'], ['Activity', '#/activity'], ['Deviations, every plant', '#/differences'], ['Design', '#/design'], ['Operator text in other languages', '#/languages'], ['Roles and grants', '#/personas']].forEach(([l, h]) => add('Page', l, '', h));
    arr(safe(() => v.plants(), [])).forEach((p) => {
      const b = `#/p/${enc(p.key)}`; add('Plant', p.name, p.stateLabel || '', b);
      [['Issues', '/issues'], ['Tasks', '/tasks'], ['Equipment', '/equipment'], ['Readings and limits', '/readings'], ['Alerts & Tasks', '/library'], ['Deviations', '/differences'], ['Structure', '/structure'], ['Activity', '/activity']].forEach(([l, s]) => add('Plant', `${p.name}: ${l}`, '', b + s));
      if (W.V7SHADOW && W.V7SHADOW.has(p.key)) add('Plant', `${p.name}: Shadow run`, '', b + '/shadow');
      arr(safe(() => v.equipment(p.key), [])).forEach((e) => add('Equipment', `${e.tag} ${e.name}`, `${e.typeName} · ${p.name}`, `${b}/eq/${enc(e.id)}`));
      if (tech && (all || p.state === 'live')) arr(safe(() => v.readings(p.key), [])).filter((r) => r.takesLimits && arr(r.dirs).length).forEach((r) => add('Change limits', `${r.name} on ${r.eqTag || 'the plant'}`, p.name, `${b}/eq/${enc(r.eqId || '')}`,
        () => { if (r.eqId) U.go(`${b}/eq/${enc(r.eqId)}`); setTimeout(() => { if (W.V7OBJ && W.V7OBJ.openLimits) W.V7OBJ.openLimits({ plant: p.key, sensorId: r.id }); }, 60); }));
    });
    arr(safe(() => v.libTypes(), [])).forEach((t) => add(t.library === 'process' ? 'Unit process' : 'Equipment type', t.typeName, t.code, `#/library/${enc(t.code)}`));
    arr(W.CTL && W.CTL.S && W.CTL.S.lib ? W.CTL.S.lib.flows : []).forEach((f) => add('Flow', f.name, f.kind === 'diagnostic' ? 'Diagnostic' : 'Steps', `#/flows/${enc(f.id)}`));
    return out;
  }
  function filter(q) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return ITEMS.filter((x) => x.kind === 'Page' || (x.kind === 'Plant' && x.label.indexOf(':') < 0)).slice(0, 12);
    const hit = ITEMS.filter((x) => words.every((w) => x.hay.includes(w)));
    const rank = (x) => (x.label.toLowerCase().startsWith(words[0]) ? 0 : x.label.toLowerCase().includes(words[0]) ? 1 : 2);
    return hit.sort((a, b) => rank(a) - rank(b) || a.label.length - b.label.length).slice(0, 12);
  }
  function draw() {
    const list = BOX.querySelector('.qj-list');
    list.innerHTML = SHOWN.length ? SHOWN.map((x, i) => `<li role="option" id="qj-${i}" aria-selected="${i === AT}" class="${i === AT ? 'on' : ''}" data-i="${i}"><span class="qj-k">${esc(x.kind)}</span><span class="qj-l">${esc(x.label)}</span><span class="qj-h">${esc(x.hint)}</span></li>`).join('') : '<li class="qj-none">Nothing matches. Try a tag, a plant, a type or a flow.</li>';
    const inp = BOX.querySelector('input'); inp.setAttribute('aria-activedescendant', SHOWN.length ? `qj-${AT}` : '');
    const on = list.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  function close() { if (BOX) { BOX.remove(); BOX = null; } }
  function pick(i) { const x = SHOWN[i]; if (!x) return; close(); if (x.run) x.run(); else U.go(x.href); }
  function open() {
    if (BOX) { BOX.querySelector('input').focus(); return; }
    ITEMS = build(); AT = 0; SHOWN = filter('');
    BOX = document.createElement('div'); BOX.className = 'qj'; BOX.setAttribute('role', 'dialog'); BOX.setAttribute('aria-label', 'Jump to');
    BOX.innerHTML = `<div class="qj-p"><input type="text" role="combobox" aria-expanded="true" aria-controls="qj-list" aria-autocomplete="list" placeholder="Jump to a plant, equipment, type or flow, or type a reading to change its limits" autocomplete="off" spellcheck="false"><ul class="qj-list" id="qj-list" role="listbox"></ul><p class="qj-f"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></p></div>`;
    document.body.appendChild(BOX); draw();
    const inp = BOX.querySelector('input'); inp.focus();
    inp.addEventListener('input', () => { SHOWN = filter(inp.value); AT = 0; draw(); });
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') { AT = Math.min(SHOWN.length - 1, AT + 1); draw(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { AT = Math.max(0, AT - 1); draw(); ev.preventDefault(); }
      else if (ev.key === 'Enter') { pick(AT); ev.preventDefault(); }
      else if (ev.key === 'Escape') { close(); ev.preventDefault(); }
    });
    BOX.addEventListener('mousedown', (ev) => { if (ev.target === BOX) close(); });
    BOX.querySelector('.qj-list').addEventListener('click', (ev) => { const li = ev.target.closest('li[data-i]'); if (li) pick(+li.getAttribute('data-i')); });
  }
  document.addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && !ev.altKey && String(ev.key).toLowerCase() === 'k') { ev.preventDefault(); open(); } });
  W.addEventListener('hashchange', close);
  U.on('q:jump', () => { open(); return false; });
  W.V7QUICK = { open, close, build, filter: (q) => { ITEMS = build(); return filter(q); } };
})();
