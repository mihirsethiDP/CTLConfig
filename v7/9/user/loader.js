/* v7/9 · user/loader.js — loads the console's own data and rules, then the user screens.
   The list of scripts is read from ../prototype.html so this page always runs the same data, library and rules as the console,
   in the same order. The console's screens are left out: only what works out the plant's set-up is loaded.
   If the list cannot be read (opened as a file), a fixed list is used. */
(function () {
  'use strict';
  var SKIP = /^(ui7|persona75|peek74|plant7|object7|lib7|work7|flag73|help73|struct73|flows73|ingestui73|calls73|decisions7|guide79|aid79)\.js/;
  var FIXED = ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'structure73.js', 'nodes73.js', 'core7.js', 'shadow77.js', 'lang77.js', 'libadd78.js', 'libtrig78.js', 'libflow7.js', 'ovx78.js', 'upalert78.js', 'crit78.js', 'dyn78.js', 'sev78.js', 'own79.js', 'cal78.js'];
  var OWN = ['user-lang.js?v=7', 'user.js?v=7', 'page.js?v=7'];
  window.US_LOAD = { missing: [], from: '' };
  function load(list) {
    var i = 0;
    (function next() {
      if (i >= list.length) return;
      var s = document.createElement('script'); s.src = list[i++];
      s.onload = next; s.onerror = function () { window.US_LOAD.missing.push(s.getAttribute('src')); next(); };
      document.head.appendChild(s);
    })();
  }
  function fixed() { window.US_LOAD.from = 'a fixed list'; return FIXED.map(function (f) { return '../assets/' + f; }); }
  var read = window.fetch ? fetch('../prototype.html', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('no page'); return r.text(); }).then(function (html) {
    var out = []; var re = /<script src="(assets\/[^"]+)"/g; var m;
    while ((m = re.exec(html))) { if (!SKIP.test(m[1].replace(/^assets\//, ''))) out.push('../' + m[1]); }
    if (out.length < 8) throw new Error('short list');
    window.US_LOAD.from = 'the console page'; return out;
  }).catch(fixed) : Promise.resolve(fixed());
  read.then(function (list) { load(list.concat(OWN)); });
})();
