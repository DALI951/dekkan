/* DEKKAN cash box tests — money in/out of the till with reusable categories.
 * The box already tracks income/expense entries; this locks down the
 * category system around them (source categories for cash IN, purpose
 * categories for cash OUT) and the new cat slot on those entries.
 * Run: node --test test/cashbox.test.js
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shop() {
  return D.createShop({ name: 'Test', startCash: 100 });
}

test('cashbox: a fresh shop starts with empty in/out category pools', () => {
  const s = shop();
  assert.ok(Array.isArray(s.categories.in));
  assert.ok(Array.isArray(s.categories.out));
  assert.strictEqual(s.categories.in.length, 0);
  assert.strictEqual(s.categories.out.length, 0);
});

test('cashbox: addCategory stores {id, name} on the right side', () => {
  let s = D.addCategory(shop(), { name: 'بيع خارجي', side: 'in' });
  s = D.addCategory(s, { name: 'كراء', side: 'out' });
  assert.strictEqual(s.categories.in.length, 1);
  assert.strictEqual(s.categories.out.length, 1);
  assert.strictEqual(s.categories.in[0].name, 'بيع خارجي');
  assert.ok(s.categories.in[0].id);
  assert.strictEqual(s.categories.out[0].name, 'كراء');
});

test('cashbox: category names are trimmed and must not be empty', () => {
  let s = shop();
  s = D.addCategory(s, { name: '  رأس المال  ', side: 'in' });
  assert.strictEqual(s.categories.in[0].name, 'رأس المال');
  assert.throws(() => D.addCategory(shop(), { name: '   ', side: 'in' }), /name/);
  assert.throws(() => D.addCategory(shop(), { name: '', side: 'out' }), /name/);
});

test('cashbox: duplicate category names are refused per side', () => {
  let s = D.addCategory(shop(), { name: 'كراء', side: 'out' });
  assert.throws(() => D.addCategory(s, { name: 'كراء', side: 'out' }), /exists/);
  // the same name on the OTHER side is a different pool — allowed
  s = D.addCategory(s, { name: 'كراء', side: 'in' });
  assert.strictEqual(s.categories.in.length, 1);
  assert.strictEqual(s.categories.out.length, 1);
});

test('cashbox: removeCategory deletes only that id from that side', () => {
  let s = D.addCategory(shop(), { name: 'a', side: 'in' });
  s = D.addCategory(s, { name: 'b', side: 'in' });
  s = D.addCategory(s, { name: 'x', side: 'out' });
  const id = s.categories.in[0].id;
  s = D.removeCategory(s, { side: 'in', id, amount: 0 });
  assert.strictEqual(s.categories.in.length, 1);
  assert.strictEqual(s.categories.in[0].name, 'b');
  assert.strictEqual(s.categories.out.length, 1, 'other side untouched');
  assert.throws(() => D.removeCategory(s, { side: 'in', id: 'nope' }), /not found/);
});

test('cashbox: income books a +entry and stores source + category', () => {
  let s = shop();
  s = D.income(s, { amount: 50, note: 'من جيبي', category: 'رأس المال' });
  const e = s.day.entries[0];
  assert.strictEqual(e.kind, 'income');
  assert.ok(e.amount > 0, 'cash went IN');
  assert.strictEqual(e.note, 'من جيبي', 'source note kept');
  assert.strictEqual(e.cat, 'رأس المال');
  assert.strictEqual(D.cash(s), 150, 'till rose by 50');
});

test('cashbox: expense books a −entry and stores purpose + category', () => {
  let s = shop();
  s = D.expense(s, { amount: 12.5, note: 'كهرباء', category: 'أداء' });
  const e = s.day.entries[0];
  assert.strictEqual(e.kind, 'expense');
  assert.ok(e.amount < 0, 'cash went OUT');
  assert.strictEqual(e.note, 'كهرباء', 'purpose note kept');
  assert.strictEqual(e.cat, 'أداء');
  assert.strictEqual(D.cash(s), 87.5, 'till dropped by 12.5');
});

test('cashbox: income/expense still work with no category (old behaviour)', () => {
  let s = D.income(shop(), { amount: 10 });
  s = D.expense(s, { amount: 4 });
  assert.strictEqual(D.cash(s), 106);
  assert.strictEqual(s.day.entries[0].cat, null);
  assert.strictEqual(s.day.entries[1].cat, null);
});

test('cashbox: deleting a category never touches entries that used it', () => {
  let s = D.addCategory(shop(), { name: 'بيع خارجي', side: 'in' });
  const id = s.categories.in[0].id;
  s = D.income(s, { amount: 20, category: 'بيع خارجي' });
  s = D.removeCategory(s, { side: 'in', id });
  const e = s.day.entries.find(x => x.kind === 'income');
  assert.strictEqual(e.cat, 'بيع خارجي', 'the ticket keeps its category name as a string');
  assert.strictEqual(s.categories.in.length, 0);
});

test('cashbox: invalid amount/side are refused everywhere', () => {
  assert.throws(() => D.income(shop(), { amount: -3 }), /positive/);
  assert.throws(() => D.expense(shop(), { amount: 0 }), /positive/);
  assert.throws(() => D.addCategory(shop(), { name: 'x', side: 'sideways' }), /side/);
});