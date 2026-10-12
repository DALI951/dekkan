// @ts-nocheck
/* DEKKAN wave 4.5 — the shop's PAPER actually prints on the shop's paper, and the
 * shop's NAME actually shows where the app's name used to be.
 *
 * RED-first. Two real bugs, both reported from the shop floor:
 *
 *   1. "when print we need to make the sheet that appear not a4 and 80mm or the
 *      number we chose" — the engine wrote `@page{size:80mm auto}`. `auto` may
 *      not be mixed with a length (the CSS grammar for `size` is
 *      `auto | <length>{1,2} | <page-size>`), so Chromium THREW THE WHOLE RULE
 *      AWAY and every ticket came out on the default sheet (US Letter). Measured
 *      in this repo's own Chromium: `size:80mm auto` -> 612x792pt (Letter),
 *      `size:80mm 297mm` -> 227x842pt (80mm). So the contract is: the size a roll
 *      gets is ALWAYS two explicit lengths, and the height is the height the
 *      ticket actually needs — never a guessed sheet.
 *
 *   2. "the top left or right where dekkan get typed i want that to be editable"
 *      — the shell's title is the SHOP's name, in the app's own style; the app's
 *      name is only the fallback for a shop that has not named itself yet.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const factory = require(path.join(ROOT, 'ui', 'pages.ts'));
const DEK = { pages: {} };
factory(DEK);
const P = DEK.pages;

const sizeOf = (css) => {
  const m = String(css).match(/@page\{([^}]*)\}/);
  assert.ok(m, 'the paper style must contain an @page rule: ' + css);
  const s = m[1].match(/size:([^;]*)/);
  assert.ok(s, '@page must set a size: ' + css);
  return s[1].trim();
};

// ---------- the paper size ----------

test('a roll is ALWAYS two explicit lengths (the bug: `80mm auto` is invalid CSS, Chromium drops it and prints on Letter)', () => {
  const css = P.paperCss('80mm', 150);
  const h = 150 + 2 * 3 + 1;
  assert.strictEqual(sizeOf(css), '80mm ' + h + 'mm', '80mm roll = width + the height the ticket needs (+ its 2 margins + 1mm of cut)');
  assert.ok(!/auto/.test(sizeOf(css)), '`auto` must never appear in the size');
});

test('the sheet has no wasted paper: the height fits the ticket, not a guessed sheet', () => {
  const content = 150, margin = 3;
  const h = Number(sizeOf(P.paperCss('80mm', content)).split(' ')[1].replace('mm', ''));
  assert.ok(h >= content + 2 * margin, 'the ticket must fit inside the margins');
  assert.ok(h <= content + 2 * margin + 2, 'and a roll must not run on for no reason');
});

test('58mm is two explicit lengths too, and a whole number of mm', () => {
  const size = sizeOf(P.paperCss('58mm', 96));
  assert.strictEqual(size, '58mm ' + (96 + 2 * 2 + 1) + 'mm');
  assert.ok(!/\d\.\d/.test(size), 'no fractional mm goes on paper');
});

test('A4 is the named size (the browser already knows A4)', () => {
  assert.strictEqual(sizeOf(P.paperCss('A4', 0)), 'A4');
});

test('the sheet width is the paper, not the default: 80mm wide, A4 wide, 58mm wide', () => {
  assert.match(P.paperCss('80mm', 150), /receipt-card\{width:74mm/);
  assert.match(P.paperCss('58mm', 150), /receipt-card\{width:54mm/);
  assert.match(P.paperCss('A4', 0), /receipt-card\{width:190mm/);
});

test('a silly height cannot make a silly sheet (a 0mm or a 5m ticket is never printed)', () => {
  assert.match(sizeOf(P.paperCss('80mm', 0)), /^80mm (4[0-9]|5[0-9])mm$/, 'a tiny content height gets a usable minimum');
  assert.match(sizeOf(P.paperCss('80mm', 9000)), /^80mm \d{3}mm$/, 'a runaway height gets clamped');
  assert.strictEqual(sizeOf(P.paperCss('80mm', null)), '80mm 297mm', 'no measurement = a whole roll of sheet, not a 40mm slip');
  assert.strictEqual(sizeOf(P.paperCss('80mm', NaN)), '80mm 297mm', 'a broken measurement is the same as no measurement');
});

test('an unknown paper choice falls back to the roll the shop most likely has (80mm)', () => {
  assert.match(sizeOf(P.paperCss('nope', 120)), /^80mm 127mm$/);
  assert.match(sizeOf(P.paperCss(undefined, 120)), /^80mm 127mm$/);
});

test('the paper margins stay the shop\'s choice (a roll is tight, A4 is not)', () => {
  assert.match(P.paperCss('80mm', 100), /@page\{size:80mm 107mm;margin:3mm\}/);
  assert.match(P.paperCss('58mm', 100), /@page\{size:58mm 105mm;margin:2mm\}/);
  assert.match(P.paperCss('A4', 0), /@page\{size:A4;margin:12mm\}/);
});

// ---------- the shop's name, in the app's own style ----------

test('the title is the SHOP\'s name when the shop has one', () => {
  assert.strictEqual(P.shopTitle({ shop: { name: 'Epicerie Ali' } }), 'Epicerie Ali');
  assert.strictEqual(P.shopTitle({ shop: { name: '  Epicerie Ali  ' } }), 'Epicerie Ali', 'trimmed');
});

test('the app\'s own name is the fallback, not the rule (a fresh shop has no name yet)', () => {
  const fallback = 'دكان';
  assert.strictEqual(P.shopTitle({ shop: { name: '' } }, fallback), fallback);
  assert.strictEqual(P.shopTitle({ shop: { name: '   ' } }, fallback), fallback);
  assert.strictEqual(P.shopTitle({}, fallback), fallback);
  assert.strictEqual(P.shopTitle(null, fallback), fallback);
});

test('the symbol is the shop\'s own first character (the letter changes, the coin does not)', () => {
  assert.strictEqual(P.shopInitial({ shop: { name: 'Ali' } }, 'د'), 'A');
  assert.strictEqual(P.shopInitial({ shop: { name: 'مخبزة النور' } }, 'د'), 'م');
  assert.strictEqual(P.shopInitial({ shop: { name: '' } }, 'د'), 'د', 'no name -> the app\'s own symbol');
  assert.strictEqual(P.shopInitial({ shop: { name: '   ' } }, 'د'), 'د');
  assert.strictEqual(P.shopInitial({ shop: { name: '  Ali' } }, 'د'), 'A', 'a leading space is not the character');
});

test('the tagline under the title is the shop\'s own when the shop wrote one', () => {
  const appTag = 'cash box + stock + debts for your shop';
  const s = { shop: { name: 'Ali' }, custom: { brand: { tagline: 'كل شيء طازج' } } };
  assert.strictEqual(P.shopTagline(s, appTag), 'كل شيء طازج');
  assert.strictEqual(P.shopTagline({ shop: { name: 'Ali' }, custom: { brand: {} } }, appTag), appTag);
  assert.strictEqual(P.shopTagline({ shop: { name: 'Ali' } }, appTag), appTag);
});
