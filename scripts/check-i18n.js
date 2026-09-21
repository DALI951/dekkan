// DEKKAN i18n check — every key used in the UI must exist in BOTH ar and en.
// Verifies: index.html data-i18n/-ph/-title keys, the UI files' T.t('...') keys,
// and that the two dicts in js/lang.js carry the exact same key set.
// Usage: node scripts/check-i18n.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lang = fs.readFileSync(path.join(ROOT, 'js', 'lang.js'), 'utf8');
// the UI layer is split across several files now — scan them all
const uiFiles = ['js/app.js', 'js/fmt.js', 'js/pages.js', 'js/actions.js', 'js/auth.js'];

// load the dicts exactly like the browser would (lang.js only touches
// localStorage/document inside try/catch + set/apply, which never run at load)
const sandbox = {
  window: {},
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  document: { documentElement: {} },
  CustomEvent: function () {},
  addEventListener: function () {}
};
vm.createContext(sandbox);
vm.runInContext(lang, sandbox);
const dicts = sandbox.window.__DEKKAN_I18N__;
const ar = dicts && dicts.AR;
const en = dicts && dicts.EN;
if (!ar) { console.error('FAIL: js/lang.js did not expose the dicts'); process.exit(1); }

const htmlKeys = new Set();
for (const attr of ['data-i18n', 'data-i18n-ph', 'data-i18n-title']) {
  for (const m of html.matchAll(RegExp(attr + '="([^"]+)"', 'g'))) htmlKeys.add(m[1]);
}
const appKeys = new Set();
for (const f of uiFiles) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/T\.t\('([^']+)'\)/g)) appKeys.add(m[1]);
}

let bad = 0;
const report = (msg) => { console.error('  FAIL ' + msg); bad++; };

// dicts must have the same keys
const arKeys = Object.keys(ar), enKeys = Object.keys(en);
new Set([...arKeys, ...enKeys]).forEach(function (k) {
  if (!(k in ar)) report("key '" + k + "' is in EN but missing from AR");
  if (!(k in en)) report("key '" + k + "' is in AR but missing from EN");
  if ((ar[k] || '').trim() === '') report("AR key '" + k + "' has an empty value");
  if ((en[k] || '').trim() === '') report("EN key '" + k + "' has an empty value");
});

// used keys must exist
htmlKeys.forEach(function (k) { if (!(k in ar)) report("index.html uses '" + k + "' — not in the dicts"); });
appKeys.forEach(function (k) { if (!(k in ar)) report("ui uses '" + k + "' — not in the dicts"); });

console.log('i18n keys: AR=' + arKeys.length + ' EN=' + enKeys.length +
  ' | html uses ' + htmlKeys.size + ' | ui uses ' + appKeys.size);

if (bad > 0) { console.error('i18n check FAILED (' + bad + ')'); process.exit(1); }
console.log('i18n check OK — every key exists in Arabic and English');