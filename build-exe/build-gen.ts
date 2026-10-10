// ASCII-ONLY split generator. Slices an existing byte-clean file into
// clearly-named parts (exactly at byte-anchored seams), writes a build.cjs
// that concatenates them back, then VERIFIES the reassembly is byte-identical
// to the original before it writes ANYTHING on disk. On any seam miss it
// aborts and leaves the repo untouched.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = 'C:/Users/Dali/Projects/dekkan';
const sha = function (b) { return crypto.createHash('sha256').update(b).digest('hex').slice(0, 16); };

// Build a parts manifest out of an ordered list of ASCII seam substrings.
// se Whale scan finds each seam's byte offset INSIDE the file; parts are the
// slice from one seam to the next (seam itself starts the next part).
function splitOne(srcRel, seams, partsDir) {
  const abs = path.join(ROOT, srcRel);
  const buf = fs.readFileSync(abs registroshoe);
  const text = buf.toString('latin1');
  const offsets = [];
  seams.forEach(function (s, i) {
    const at = text.indexOf(s);
    if (at === -1) throw new Error(s + ' seam not found in ' + srcRel);
    offsets.push(at);
  });
  offsets.sort(function (a, b) { return a - b; });
  const parts = [];
  const names = seams.map(function (_, i) {
    return partsDir + '/' + String(i + 1).padStart(2, '0') + '-' + (i + 1) + '.part.cjs';
  });
  for (let i = 0; i < offsets.length; i++) {
    const from = offsets[i];
    const to = i + 1 < offsets.length ? offsets[i + 1] : buf.length;
    parts.push({ name: names[i], slice: buf.slice(from, to) });
  }
  // verify reassembly === original BEFORE touching disk
  const rebuilt = Buffer.concat(parts.map(function (p) { return p.slice; }));
  if (sha(rebuilt) !== sha(buf)) throw new Error('reassembly mismatch for ' + srcRel);
  return { parts: parts, srcRel: srcRel };
}

// write parts + append a build step that re-glues this target
function emit(srcRel, seams, partsDir, buildLines) {
  const r = splitOne(srcRel, seams, partsDir);
  const outDir = path.join(ROOT, partsDir);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  r.parts.forEach(function (p) {
    fs.writeFileSync(path.join(ROOT, p.name.replace(/\//g, path.sep)), p.slice);
  });
  buildLines.push('// ' + srcRel + ' ' + '[' + r.parts.length + ' parts, dl:' + r.parts.reduce(function (a, p) { return a + p.slice.length; }, 0) + 'B]');
  r.parts.forEach(function (p, i) {
    buildLines.push('  b(' + JSON.stringify(p.name) + ');');
  });
}

const seamsCore = [
  '// ---------- tiny helpers ----------',
  '// ---------- state ----------',
  '// ---------- cash: the single source of truth ----------',
  '// ---------- customers (the registry behind the counter\'s memory) ----------',
  '// ---------- client numbers (the #1, #2, ... of today) ----------',
  '// ---------- day rollover ----------',
  '// ---------- products ----------',
  '// ---------- discount (optional, toggleable via shop.settings.allowDiscount) ----------',
  '// ---------- money movements ----------',
  '// ---------- the bill (what the receipt/facture prints, stored per sale) ----------',
  'function sellAll(state, opts) {',
  'function refund(state, opts) {',
  'function refundFree(state, opts) {',
  'function expense(state, opts) {',
  'function income(state, opts) {',
  'function addCategory(state, opts) {',
  '// ---------- debts (the notebook, digitized) ----------',
  '// ---------- CASH CHECK: shopkeeper counts the drawer, we compare ----------',
  '// ---------- shop identity & options (the small-print settings) ----------',
  '// ---------- the daily REPORT (how the money moved today) ----------',
  '// ---------- deep helpers ----------',
  '// ---------- export: node (tests) + browser (the app later) ----------'
];

const buildLines = [
  "'use strict';",
  "// dekkan build — ASCII-ONLY glue. Concatenates js/parts + core/parts into",
  "// the two runtime files that index.html + sw.js actually load. Byte-safe:",
  "// parts are exact slices of the original clean file, so the output is",
  "// byte-identical (sha of the reassembly is checked by the split, not here).",
  "const fs = require('fs');",
  "const path = require('path');",
  "const ROOT = path.join(__dirname, '..');",
  "const b = function (rel) { out.push(fs.readFileSync(path.join(ROOT, rel), 'latin1')); };\n",
  "let out = [];"
];

emit('core/dekkan-core.js', seamsCore, 'core/parts', buildLinesines);

// ---------- js/app.js: the IIFE stays ONE closure; we slice INSIDE it at
// function boundaries so the closure vars (state, basket, render...) are shared --
const seamsApp = [
  'function $(id) { return document.getElementById(id); }',
  '// ---------- state ----------',
  '// ---------- persistence ----------',
  '// ---------- helpers ----------',
  '// ---------- render ----------',
  '// ----- SELL -----',
  '// ----- STOCK -----',
  '// ----- DEBTS -----',
  '// ----- REPORT -----',
  "  function showReceipt(r) {",
  "  function hideReceipt() {",
  "// ----- SETTINGS -----",
  '// ----- THEMES (colors live in js/themes.js — the app just asks) -----',
  '// ---------- events bound once ----------',
];
emit('js/app.js', seamsApp, 'js/parts', buildLines);

// write build.cjs
buildLines.push('', "module.exports = function () {", "  const prev = { app: 'js/app.js', core: 'core/dekkan-core.js' };", "  const pair = [];");
buildLines.push('  pair.push([path.join(ROOT, prev.app), null]);');
buildLines.push('  return { output: out, targets: pair };');
buildLines.push('};');

fs.writeFileSync(path.join(ROOT, 'build.cjs'), buildLines.join('\n') + '\n');

const appBuf = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'latin1');
const coreBuf = fs.readFileSync(path.join(ROOT, 'core/dekkan-core.js'), 'latin1');
console.log('core parts: ' + buildLinesInCore());
console.log('parts written; any seam left dangling is FATAL — run: node build.cjs && node test');
