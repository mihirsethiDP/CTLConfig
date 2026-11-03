/* v7/2 · tests/load72.js — loads the v7/2 prototype headless in node, in prototype.html's order, for every v7/2 test.
   Node only, no dependencies. Stubs window, document, location and localStorage (an in-memory map; optionally backed by a JSON
   file so two processes can share one store), sets window.V7_VARIANT = '2', loads every asset that exists (a file not written
   yet is skipped and listed in `missing`), then boots V7 once every file has loaded and registered its hooks, as V7UI.start()
   does in the browser.

   const L = require('./load72');   →  { V7, V7UI, CTL, render(hash), reset(), store, files, loaded, missing, errors, window }
     render('#/p/vedanta')  the page's html through V7UI.renderPath (null when ui7.js is not loaded)
     reset()                V7.reset(): "Reset the story"
   Options come from the environment, so a test can run another configuration in a child process:
     LOAD72_UPTO=core7.js   stop after this file (e.g. core7.js alone, before the other core files)
     LOAD72_SKIP=a.js,b.js  leave these files out (e.g. to stub a module written by someone else)
     LOAD72_STORE=<file>    back localStorage with this JSON file (read at start, written on every change)
     LOAD72_NO_BOOT=1       load without booting
   A file that throws while loading is listed in `errors` (and printed to stderr) instead of stopping the load. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const ORDER = ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js',
  'core7.js', 'core72-structure.js', 'core72-library.js', 'core72-ledger.js', 'core72-commission.js',
  'ui7.js', 'plant7.js', 'lists7.js', 'structure7.js', 'object7.js', 'lib7.js', 'ledger7.js', 'work7.js', 'decisions7.js'];

const env = process.env;
const UPTO = env.LOAD72_UPTO || '';
const SKIP = new Set(String(env.LOAD72_SKIP || '').split(',').map((s) => s.trim()).filter(Boolean));
const STORE_FILE = env.LOAD72_STORE || '';

/* ── stubs ─────────────────────────────────────────────────────────────────────────────────── */
const g = global;
function classList() {
  const s = new Set();
  return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; if (on) s.add(c); else s.delete(c); return on; }, contains: (c) => s.has(c), get length() { return s.size; } };
}
function el(tag) {
  return {
    tagName: String(tag || 'div').toUpperCase(), nodeName: String(tag || 'div').toUpperCase(), nodeType: 1, children: [], childNodes: [], style: {}, dataset: {}, attributes: {},
    innerHTML: '', outerHTML: '', textContent: '', innerText: '', value: '', checked: false, disabled: false, className: '', id: '', name: '', type: '',
    classList: classList(), parentNode: null, parentElement: null, firstChild: null, lastChild: null, nextSibling: null, previousSibling: null,
    offsetTop: 0, offsetLeft: 0, offsetHeight: 0, offsetWidth: 0, scrollTop: 0, scrollLeft: 0, scrollHeight: 0, clientHeight: 0, clientWidth: 0,
    setAttribute(k, v) { this.attributes[k] = String(v); }, getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }, removeAttribute(k) { delete this.attributes[k]; }, toggleAttribute() { return false; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    appendChild(c) { this.children.push(c); return c; }, removeChild(c) { return c; }, insertBefore(c) { return c; }, replaceChild(c) { return c; },
    append() {}, prepend() {}, after() {}, before() {}, remove() {}, replaceWith() {}, insertAdjacentHTML() {}, insertAdjacentElement() {}, cloneNode() { return el(tag); },
    querySelector() { return null; }, querySelectorAll() { return []; }, getElementsByTagName() { return []; }, getElementsByClassName() { return []; },
    closest() { return null; }, matches() { return false; }, contains() { return false; },
    focus() {}, blur() {}, click() {}, select() {}, scrollIntoView() {}, scrollTo() {}, scrollBy() {}, setSelectionRange() {}, showModal() {}, close() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }, getClientRects() { return []; },
    animate() { return { finished: Promise.resolve(), cancel() {} }; },
  };
}
/* localStorage: an in-memory map, optionally mirrored to a JSON file */
const store = new Map();
if (STORE_FILE && fs.existsSync(STORE_FILE)) { try { Object.entries(JSON.parse(fs.readFileSync(STORE_FILE, 'utf8') || '{}')).forEach(([k, v]) => store.set(k, String(v))); } catch (e) { /* an unreadable file starts empty */ } }
const flush = () => { if (STORE_FILE) fs.writeFileSync(STORE_FILE, JSON.stringify(Object.fromEntries(store))); };
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); flush(); },
  removeItem: (k) => { store.delete(k); flush(); },
  clear: () => { store.clear(); flush(); },
  key: (i) => [...store.keys()][i] || null,
  get length() { return store.size; },
};
g.window = g; g.self = g;
const doc = el('#document');
Object.assign(doc, {
  nodeType: 9, body: el('body'), head: el('head'), documentElement: el('html'), activeElement: null, title: '', cookie: '', readyState: 'complete', hidden: false, visibilityState: 'visible',
  createElement: el, createElementNS: (ns, t) => el(t), createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }), createDocumentFragment: () => el('#fragment'),
  createRange: () => ({ selectNodeContents() {}, setStart() {}, setEnd() {}, collapse() {} }),
  getElementById: () => null, getSelection: () => ({ removeAllRanges() {}, addRange() {} }), execCommand: () => false, contains: () => false, hasFocus: () => true,
});
g.document = doc;
g.localStorage = localStorage;
g.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
g.location = { hash: '#/plants', href: 'http://localhost/v7/2/prototype.html#/plants', pathname: '/v7/2/prototype.html', search: '', origin: 'http://localhost', assign() {}, replace() {}, reload() {} };
g.history = { replaceState() {}, pushState() {}, back() {} };
if (!g.navigator) { try { g.navigator = { userAgent: 'node', clipboard: { writeText: () => Promise.resolve() } }; } catch (e) { /* read-only in newer node */ } }
g.addEventListener = () => {}; g.removeEventListener = () => {}; g.dispatchEvent = () => true;
g.scrollTo = () => {}; g.scrollBy = () => {}; g.innerWidth = 1280; g.innerHeight = 900;
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
g.requestAnimationFrame = (fn) => setTimeout(fn, 0); g.cancelAnimationFrame = (id) => clearTimeout(id);
g.getComputedStyle = () => ({ getPropertyValue: () => '' });
g.open = () => null; g.alert = () => {}; g.confirm = () => true; g.prompt = () => null;
if (!g.Blob) g.Blob = function Blob() {};
if (!g.URL) g.URL = {};
if (!g.URL.createObjectURL) g.URL.createObjectURL = () => 'blob:stub';
g.V7_NO_V6_SHELL = true; g.V7_VARIANT = '2';

/* ── load ──────────────────────────────────────────────────────────────────────────────────── */
const files = []; const loaded = []; const missing = []; const errors = [];
for (const f of ORDER) {
  if (SKIP.has(f)) { if (f === UPTO) break; continue; }
  files.push(f);
  const file = path.join(ASSETS, f);
  if (!fs.existsSync(file)) { missing.push(f); if (f === UPTO) break; continue; }
  try { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); loaded.push(f); }
  catch (e) { errors.push({ file: f, error: String(e && e.stack ? e.stack : e) }); process.stderr.write(`load72: ${f} failed to load: ${e && e.message ? e.message : e}\n`); }
  if (f === UPTO) break;
}
const V7 = g.V7 || null;
const V7UI = g.V7UI || null;
if (V7 && typeof V7.boot === 'function' && !env.LOAD72_NO_BOOT) {
  try { V7.boot(); } catch (e) { errors.push({ file: 'boot', error: String(e && e.stack ? e.stack : e) }); process.stderr.write(`load72: V7.boot() failed: ${e && e.message ? e.message : e}\n`); }
}

function render(hash) { const U = g.V7UI; if (!U || typeof U.renderPath !== 'function') return null; g.location.hash = String(hash || '#/plants'); return U.renderPath(hash); }
function reset() { return g.V7 && typeof g.V7.reset === 'function' ? g.V7.reset() : null; }

module.exports = { V7, V7UI, CTL: g.CTL || null, render, reset, store, files, loaded, missing, errors, window: g, ORDER: ORDER.slice(), ASSETS };
