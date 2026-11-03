#!/usr/bin/env node
/* v7/2 · tests/nohardcode72.js — no story number is typed into the page code. Every number a page shows comes from a core
   function, so this reads the string literals (quotes and template text, comments left out) of the page modules and fails on
   any literal that carries one of the story's numbers ("40.0", "12.8", "2,200", "51 of 73" …). A page module not written yet
   is listed and skipped. Node only, no dependencies.
   Usage: TZ=Asia/Calcutta node tests/nohardcode72.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const VERBOSE = process.argv.includes('-v');
const ASSETS = path.resolve(__dirname, '..', 'assets');
const FILES = ['lib7.js', 'object7.js', 'plant7.js', 'lists7.js', 'ledger7.js', 'structure7.js', 'work7.js', 'ui7.js'];
/* the story's numbers as a page would print them: derived currents and their moved bases, trial rates and counts, the
   chapter 10 publish, the go-live Tasks, the structure pass's change of type */
const STORY = ['40.0', '42.0', '46.0', '33.6', '35.3', '38.6', '31.9', '28.6', '20.0 / 21.0', '12.8', '5.9 days', '5.9 a day', '76 times', '112 trial', '2,200', '2,500', '51 of 73', '28.8', '44 / 48', '(3.4 m)', '(3.8 m)', '(4.3 m)'];

/* string literals of a JavaScript source, comments left out: '…', "…" and the text parts of `…${…}…` (nested), regex literals
   skipped by a small heuristic (a slash where a value cannot end) */
function literals(src) {
  const out = []; let i = 0; const n = src.length; const stack = []; let prevSig = '';
  const push = (s, line) => { if (s) out.push({ text: s, line }); };
  const lineAt = (k) => src.slice(0, k).split('\n').length;
  while (i < n) {
    const c = src[i]; const d = src[i + 1];
    if (stack.length && stack[stack.length - 1] === '{' && c === '}') { stack.pop(); i++; if (stack.length && stack[stack.length - 1] === '`') { i = tmpl(i); } continue; }
    if (c === '{' && stack.length) { stack.push('{'); i++; prevSig = c; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (c === '\'' || c === '"') { const st = i; let s = ''; i++; while (i < n && src[i] !== c) { if (src[i] === '\\') { s += src[i + 1]; i += 2; continue; } s += src[i++]; } i++; push(s, lineAt(st)); prevSig = 'a'; continue; }
    if (c === '`') { stack.push('`'); i = tmpl(i + 1); continue; }
    if (c === '/' && (/[(,=:[!&|?{};+\-*%<>~^]/.test(prevSig) || prevSig === '' || /\breturn$/.test(src.slice(Math.max(0, i - 7), i).trim()))) {
      i++; let cls = false; while (i < n) { const x = src[i]; if (x === '\\') { i += 2; continue; } if (x === '[') cls = true; else if (x === ']') cls = false; else if (x === '/' && !cls) break; else if (x === '\n') break; i++; } i++; while (/[a-z]/i.test(src[i] || '')) i++; prevSig = 'a'; continue;
    }
    if (!/\s/.test(c)) prevSig = c; i++;
  }
  return out;
  /* inside a template literal starting at k: collect text up to the closing backtick or the next ${ */
  function tmpl(k) {
    let s = ''; const st = k;
    while (k < n) {
      const x = src[k];
      if (x === '\\') { s += src[k + 1]; k += 2; continue; }
      if (x === '`') { push(s, lineAt(st)); stack.pop(); prevSig = 'a'; return k + 1; }
      if (x === '$' && src[k + 1] === '{') { push(s, lineAt(st)); stack.push('{'); prevSig = '{'; return k + 2; }
      s += x; k++;
    }
    push(s, lineAt(st)); return k;
  }
}

const results = []; let fails = 0; const missing = [];
for (const f of FILES) {
  const file = path.join(ASSETS, f);
  if (!fs.existsSync(file)) { missing.push(f); continue; }
  const lits = literals(fs.readFileSync(file, 'utf8'));
  const hits = []; lits.forEach((l) => STORY.forEach((num) => { if (l.text.includes(num)) hits.push(`line ${l.line}: "${num}" in ${JSON.stringify(l.text.slice(0, 80))}`); }));
  results.push({ f, n: lits.length, hits }); if (hits.length) fails++;
}
/* the reader itself: it must find literals and skip comments */
const probe = literals("/* '40.0' */ const a = 'x 40.0'; // \"12.8\"\nconst b = `t ${c ? `in 2,200` : ''} 51 of 73`; const r = /12\\.8/; const d = \"5.9 days\";");
const selfOk = probe.map((x) => x.text).join('|') === 'x 40.0|t |in 2,200| 51 of 73|5.9 days';
console.log(`nohardcode72 · ${FILES.length - missing.length} page modules read${missing.length ? ` · not written yet: ${missing.join(', ')}` : ''}`);
results.forEach((r) => { console.log(`  ${r.hits.length ? 'FAIL' : 'ok  '} ${r.f.padEnd(14)} ${r.n} literals${r.hits.length ? ` · ${r.hits.length} story numbers` : ''}`); if (r.hits.length || VERBOSE) r.hits.forEach((h) => console.log(`       ✗ ${h}`)); });
console.log(`  ${selfOk ? 'ok  ' : 'FAIL'} the literal reader skips comments and regexes, and reads template text`);
if (!selfOk) { fails++; console.log(`       ✗ ${JSON.stringify(probe.map((x) => x.text))}`); }
console.log(fails ? `RESULT: FAIL · ${fails} failing` : 'RESULT: PASS');
process.exit(fails ? 1 : 0);
