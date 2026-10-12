// @ts-nocheck
// DEKKAN UI — the shop's own number/date FORMATS (wave 3, part A).
//
// RED-first: written before ui/fmt.ts knew about `state.custom.money` /
// `state.custom.date`.
//
// The rule that shapes this file: DEFAULTS ARE TODAY'S OUTPUT, BYTE FOR BYTE.
// Every shop that never opens the new settings keeps printing exactly what it
// printed before (3 decimals, no grouping, the currency word of the interface
// language, ISO dates, 24h times). A new shop in Tunisia can then change any of
// it — a 2-decimal shop, a "1 500,500"-style grouping, Arabic-Indic numerals —
// without anything about the old behaviour moving.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const factory = require('../ui/fmt.ts');
const D = require('../core/dekkan-core.ts');

// fmt is a UMD factory: hand it a DEK object and it fills in DEK.fmt
function boot(lang, custom) {
  const DEK = {};
  factory(DEK);
  const fmt = DEK.fmt;
  const curr = { ar: 'د.ت', en: 'TND' }[lang];
  fmt._setT({ lang: lang, t: (k) => (k === 'curr' ? curr : k) });
  if (custom) fmt._setCustom(custom);
  return fmt;
}

// ---------- the defaults: unchanged ----------

test('with nothing customized, money prints exactly like it always did', () => {
  assert.strictEqual(boot('ar').money(1500.5), '1500.500 د.ت');
  assert.strictEqual(boot('en').money(1500.5), '1500.500 TND');
  assert.strictEqual(boot('ar').money(0), '0.000 د.ت');
  assert.strictEqual(boot('ar').money(-12.5), '-12.500 د.ت');
  assert.strictEqual(boot('ar').money(0.0004), '0.000 د.ت', 'the third decimal is the smallest the core ever rounds to');
});

test('with nothing customized, dates and times print exactly like they always did', () => {
  const f = boot('ar');
  assert.strictEqual(f.docDate('2026-10-12'), '2026-10-12');
  assert.strictEqual(f.docDate('2026-10-12T09:05:00Z'), '2026-10-12');
  assert.strictEqual(f.entryTime('2026-10-12T14:32:00'), '14:32');
});

// ---------- a shop that DOES change them ----------

test('the currency: its own symbol, before or after the number', () => {
  const f = boot('ar', { money: { symbol: 'DT', position: 'after' } });
  assert.strictEqual(f.money(1500.5), '1500.500 DT', 'a fixed symbol beats the language word');
  const g = boot('ar', { money: { symbol: 'DT', position: 'before' } });
  assert.strictEqual(g.money(1500.5), 'DT 1500.500');
});

test('an empty symbol still follows the interface language (the default is a choice too)', () => {
  assert.strictEqual(boot('ar', { money: { symbol: '' } }).money(5), '5.000 د.ت');
  assert.strictEqual(boot('en', { money: { symbol: '' } }).money(5), '5.000 TND');
});

test('decimals: 0, 1 and 2 — and anything out of range falls back to 3', () => {
  assert.strictEqual(boot('ar', { money: { decimals: 2 } }).money(1500.5), '1500.50 د.ت');
  assert.strictEqual(boot('ar', { money: { decimals: 1 } }).money(1500.56), '1500.6 د.ت');
  assert.strictEqual(boot('ar', { money: { decimals: 0 } }).money(1500.4), '1500 د.ت');
  assert.strictEqual(boot('ar', { money: { decimals: 0 } }).money(1500.5), '1501 د.ت', 'and it rounds, never truncates');
  assert.strictEqual(boot('ar', { money: { decimals: 9 } }).money(1), '1.000 د.ت', 'a value the gate would refuse cannot blank the screen');
});

test('thousands: a space, a comma, a dot — or nothing at all', () => {
  assert.strictEqual(boot('ar', { money: { thousands: ' ' } }).money(1500.5), '1 500.500 د.ت');
  assert.strictEqual(boot('en', { money: { thousands: ',' } }).money(1500.5), '1,500.500 TND');
  assert.strictEqual(boot('en', { money: { thousands: ',' } }).money(12450200), '12,450,200.000 TND', 'every group, not just the first');
  assert.strictEqual(boot('en', { money: { thousands: '' } }).money(12450200), '12450200.000 TND');
  assert.strictEqual(boot('en', { money: { thousands: ',' } }).money(-1500.5), '-1,500.500 TND', 'the minus stays outside the groups');
});

test('digits: Arabic-Indic numerals for a shop that wants them', () => {
  assert.strictEqual(boot('ar', { money: { digits: 'arabic' } }).money(1500.5), '١٥٠٠.٥٠٠ د.ت');
  assert.strictEqual(boot('ar', { money: { digits: 'arabic', thousands: ' ' } }).money(1500.5), '١ ٥٠٠.٥٠٠ د.ت');
  assert.strictEqual(boot('ar', { money: { digits: 'arabic' } }).money(-2), '-٢.٠٠٠ د.ت', 'the sign is not a digit');
});

test('the date the shop writes on its own paper', () => {
  const at = (format) => boot('ar', { date: { format } }).docDate('2026-10-12');
  assert.strictEqual(at('DD/MM/YYYY'), '12/10/2026');
  assert.strictEqual(at('MM/DD/YYYY'), '10/12/2026');
  assert.strictEqual(at('DD-MM-YYYY'), '12-10-2026');
  assert.strictEqual(at('DD.MM.YYYY'), '12.10.2026');
  assert.strictEqual(at('YYYY/MM/DD'), '2026/10/12');
  assert.strictEqual(at('nonsense'), '2026-10-12', 'a broken format prints the ISO date, never garbage');
  assert.strictEqual(boot('ar').docDate(''), '', 'nothing in, nothing out');
});

test('times: 24h by default, 12h for a shop that asks for it', () => {
  const t = (time) => boot('ar', { date: { time } }).entryTime;
  assert.strictEqual(t('24h')('2026-10-12T14:32:00'), '14:32');
  assert.strictEqual(t('12h')('2026-10-12T14:32:00'), '02:32 PM');
  assert.strictEqual(t('12h')('2026-10-12T00:05:00'), '12:05 AM');
  assert.strictEqual(t('12h')('2026-10-12T12:00:00'), '12:00 PM');
});

test('a broken custom block never blanks what the shopkeeper sees', () => {
  const f = boot('ar', { money: null, date: 'nope' });
  assert.strictEqual(f.money(5), '5.000 د.ت');
  assert.strictEqual(f.docDate('2026-10-12'), '2026-10-12');
  f._setCustom(undefined);
  assert.strictEqual(f.money(5), '5.000 د.ت', 'and it can be reset to the defaults');
});

test('the two copies of the date-format list can never drift apart', () => {
  // ui/fmt.ts has no imports (it is a browser UMD), so it keeps its own copy of the
  // legal formats. This test is the seam: change one list, change the other.
  const fmt = boot('ar');
  assert.deepStrictEqual(Array.from(fmt.DATE_FORMATS), Array.from(D.CUSTOM_DATE_FORMATS));
});

// ---------- the core's half: the gate knows what a legal format is ----------

test('the gate accepts the new "follow the language" symbol and the real separators', () => {
  const ok = D.defaultCustom();
  assert.strictEqual(ok.money.symbol, '', 'empty = follow the interface language');
  assert.strictEqual(ok.money.thousands, '', 'no grouping by default — exactly what the app printed before');
  assert.deepStrictEqual(D.customProblems(ok), []);
  assert.deepStrictEqual(D.customProblems(D.setCustom(D.createShop({}), { money: { symbol: 'DT', thousands: ',' } }).custom), []);
  assert.deepStrictEqual(D.customProblems(D.setCustom(D.createShop({}), { date: { format: 'DD/MM/YYYY', time: '12h' } }).custom), []);
});

test('the gate still refuses a format that is not one', () => {
  const c = (patch) => {
    const custom = D.defaultCustom();
    Object.assign(custom.money, patch.money || {});
    Object.assign(custom.date, patch.date || {});
    return D.customProblems(custom);
  };
  assert.ok(c({ date: { format: 'whatever' } }).some((p) => /date\.format/.test(p)), 'an unknown date format');
  assert.ok(c({ date: { time: '13h' } }).some((p) => /date\.time/.test(p)), 'an unknown clock');
  assert.ok(c({ money: { symbol: 'long-symbol-here' } }).some((p) => /money\.symbol/.test(p)), 'a symbol that is not a symbol');
  assert.ok(c({ money: { decimals: 4 } }).some((p) => /decimals/.test(p)), 'a third decimal is the most the core can honestly round to');
  // the strict write path refuses it instead of writing it (the pure-state rule)
  assert.throws(() => D.setCustom(D.createShop({}), { money: { decimals: 4 } }), /custom:/);
});
