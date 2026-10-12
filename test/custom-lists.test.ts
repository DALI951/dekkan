// DEKKAN CORE — the shop's own LISTS (wave 4 of docs/customize-plan.md).
//
// RED-first: this file was written BEFORE `custom.lists` existed.
//
// WHY lists matter: a phone shop sells pieces, a grocery sells kilos, a café sells
// cups. The app has to stop deciding that for the shop. This wave gives the shop
// three lists it owns — product UNITS, SUPPLIERS, REFUND REASONS — plus the one
// thing that makes them real: a product remembers its unit and the ticket prints it.
//
// The contract under test:
//   * every shop carries `custom.lists` with four unit choices and no suppliers /
//     refund reasons (a fresh shop AND an old save, which is repaired, never crashed)
//   * `setCustom` is STRICT about a list: an unknown list name, a non-text item, an
//     empty item, a duplicate, too many items and an over-long item are all refused
//     BY NAME and change nothing
//   * `units` may never be emptied (a product form with no unit is a broken form);
//     suppliers and refund reasons may be empty (that is today's behaviour)
//   * `ensureCustomState` REPAIRS what it cannot read and keeps every readable item,
//     and repairing twice changes nothing (a repaired state is a fixed point)
//   * a product REMEMBERS its unit, and the unit travels into the sale line so the
//     printed ticket can say "×2 kg" instead of "×2"
//   * the integrity gate refuses a state whose lists block is nonsense
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

// ---------- defaults ----------

test('a fresh shop owns its lists: four units, no suppliers, no refund reasons', () => {
  const s = D.createShop({ name: 'Test' });
  assert.ok(s.custom.lists && typeof s.custom.lists === 'object', 'custom.lists must exist');
  assert.deepStrictEqual(s.custom.lists.units, ['piece', 'kg', 'litre', 'pack']);
  assert.deepStrictEqual(s.custom.lists.suppliers, []);
  assert.deepStrictEqual(s.custom.lists.refundReasons, []);
});

test('the defaults are themselves valid (the gate accepts a fresh shop)', () => {
  assert.deepStrictEqual(D.customProblems(D.defaultCustom()), []);
});

// ---------- the strict write path ----------

test('the shop can rename its unit list and add a supplier', () => {
  let s = D.createShop({ name: 'Test' });
  s = D.setCustom(s, { lists: { units: ['kg', 'gram'], suppliers: ['Grossiste Ali'] } });
  assert.deepStrictEqual(s.custom.lists.units, ['kg', 'gram']);
  assert.deepStrictEqual(s.custom.lists.suppliers, ['Grossiste Ali']);
  assert.deepStrictEqual(s.custom.lists.refundReasons, [], 'an untouched list keeps its value');
});

test('an unknown list is refused BY NAME and nothing changes', () => {
  const s = D.createShop({ name: 'Test' });
  assert.throws(() => D.setCustom(s, { lists: { colours: ['red'] } }), /lists\.colours/);
  assert.deepStrictEqual(s.custom.lists.units, ['piece', 'kg', 'litre', 'pack'], 'the state is untouched');
});

test('a non-text, empty or over-long item is refused BY NAME', () => {
  const s = D.createShop({ name: 'Test' });
  assert.throws(() => D.setCustom(s, { lists: { units: ['kg', 5] } }), /lists\.units/);
  assert.throws(() => D.setCustom(s, { lists: { units: ['kg', '   '] } }), /lists\.units/);
  assert.throws(() => D.setCustom(s, { lists: { units: ['k'.repeat(25)] } }), /lists\.units/);
  assert.throws(() => D.setCustom(s, { lists: { refundReasons: ['x'.repeat(61)] } }), /lists\.refundReasons/);
});

test('the same item twice is refused (the form would offer it twice)', () => {
  const s = D.createShop({ name: 'Test' });
  assert.throws(() => D.setCustom(s, { lists: { units: ['kg', 'kg'] } }), /lists\.units/);
});

test('a unit list can never be emptied, but the other two lists may', () => {
  const s = D.createShop({ name: 'Test' });
  assert.throws(() => D.setCustom(s, { lists: { units: [] } }), /lists\.units/);
  const ok = D.setCustom(s, { lists: { units: ['piece'], suppliers: [], refundReasons: [] } });
  assert.deepStrictEqual(ok.custom.lists.suppliers, []);
});

test('a list has a ceiling (a form with 500 suppliers is not a form)', () => {
  const s = D.createShop({ name: 'Test' });
  const many = [];
  for (let i = 0; i < 51; i++) many.push('fournisseur ' + i);
  assert.throws(() => D.setCustom(s, { lists: { suppliers: many } }), /lists\.suppliers/);
  const plenty = [];
  for (let i = 0; i < 24; i++) plenty.push('unit ' + i);
  assert.ok(D.setCustom(s, { lists: { units: plenty } }).custom.lists.units.length === 24);
});

// ---------- the repair path (boot + import) ----------

test('a lists block from another build is repaired, not crashed on', () => {
  const s = D.createShop({ name: 'Test' });
  s.custom.lists = 'nonsense';
  const fixed = D.ensureCustomState(s);
  assert.deepStrictEqual(fixed.custom.lists.units, ['piece', 'kg', 'litre', 'pack']);
  assert.deepStrictEqual(D.customProblems(fixed.custom), [], 'the repaired state passes the gate');
});

test('repair keeps every readable item and drops only the junk', () => {
  const s = D.createShop({ name: 'Test' });
  s.custom.lists = { units: ['kg', 5, '  ', 'kg', 'litre'], suppliers: 'x', refundReasons: ['broken', null] };
  const fixed = D.ensureCustomState(s);
  assert.deepStrictEqual(fixed.custom.lists.units, ['kg', 'litre'], 'readable, trimmed, de-duplicated, in order');
  assert.deepStrictEqual(fixed.custom.lists.suppliers, [], 'unreadable list falls back to the default');
  assert.deepStrictEqual(fixed.custom.lists.refundReasons, ['broken']);
});

test('repairing twice changes nothing (a repaired state is a fixed point)', () => {
  const s = D.createShop({ name: 'Test' });
  s.custom.lists = { units: [''], suppliers: [7] };
  const once = D.ensureCustomState(s);
  const twice = D.ensureCustomState(JSON.parse(JSON.stringify(once)));
  assert.deepStrictEqual(twice.custom.lists, once.custom.lists);
});

test('a units list that repair cannot salvage comes back as the defaults', () => {
  const s = D.createShop({ name: 'Test' });
  s.custom.lists = { units: [1, 2, 3], suppliers: [], refundReasons: [] };
  const fixed = D.ensureCustomState(s);
  assert.deepStrictEqual(fixed.custom.lists.units, ['piece', 'kg', 'litre', 'pack']);
});

// ---------- the gate ----------

test('the integrity gate reports a broken lists block', () => {
  const s = D.createShop({ name: 'Test' });
  s.custom.lists.units = [];
  const problems = D.stateProblems(s);
  assert.ok(problems.some(p => /custom: lists\.units/.test(p)), 'stateProblems must name the list: ' + JSON.stringify(problems));
});

// ---------- a product remembers its unit ----------

test('a product keeps the unit the shop chose', () => {
  const s = D.addProduct(D.createShop({ name: 'Test' }), { name: 'Sugar', sell: 2, unit: 'kg' });
  const p = s.products[0];
  assert.strictEqual(p.unit, 'kg');
});

test('a product with no unit stays unchanged (today\'s product, byte for byte)', () => {
  const s = D.addProduct(D.createShop({ name: 'Test' }), { name: 'Soda', sell: 1.5 });
  assert.strictEqual(s.products[0].unit, '');
});

test('a unit that is not a short text is refused', () => {
  const s = D.createShop({ name: 'Test' });
  assert.throws(() => D.addProduct(s, { name: 'Sugar', sell: 2, unit: 5 }), /unit/);
  assert.throws(() => D.addProduct(s, { name: 'Sugar', sell: 2, unit: 'k'.repeat(25) }), /unit/);
});
