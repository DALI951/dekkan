/* CORE — backup import: restoreState must accept a real exported backup,
 * repair legacy gaps (v2 shops without the customer registry), and REFUSE
 * junk without touching anything. The export side already exists; this is
 * the missing round-trip (Dali: "the shop dies the moment the phone dies").
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function fullBackup() {
  let s = D.createShop({ name: 'Test', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  const pid = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: pid, qty: 2, buy: 0.8, sell: 1.5 }] });
  return s; // an exported backup IS this state, JSON-stringified
}

test('restoreState: a valid exported backup restores the exact state', () => {
  const backup = fullBackup();
  const restored = D.restoreState(JSON.parse(JSON.stringify(backup)));
  assert.deepStrictEqual(restored, backup);
  assert.strictEqual(D.cash(restored), 53, 'cash math identical after restore');
});

test('restoreState: refuses non-objects and junk', () => {
  for (const junk of [null, undefined, 42, 'hello', [], true]) {
    assert.throws(() => D.restoreState(junk), /backup/);
  }
  assert.throws(() => D.restoreState({}), /products/);
});

test('restoreState: refuses backups missing required arrays', () => {
  const bad = fullBackup();
  delete bad.products;
  assert.throws(() => D.restoreState(bad), /products/);
  const bad2 = fullBackup();
  delete bad2.day;
  assert.throws(() => D.restoreState(bad2), /day/);
  const bad3 = fullBackup();
  bad3.day = { date: '2026-01-01' }; // no entries array
  assert.throws(() => D.restoreState(bad3), /open day/);
});

test('restoreState: repairs legacy v2 backups (no customers registry)', () => {
  const old = fullBackup();
  delete old.customers;
  delete old.categories;
  delete old.employees;
  const repaired = D.restoreState(old);
  assert.deepStrictEqual(repaired.customers, []);
  assert.deepStrictEqual(repaired.categories, { in: [], out: [] });
  assert.deepStrictEqual(repaired.employees, []);
  // products + money survived the repair untouched
  assert.strictEqual(repaired.products.length, 1);
  assert.strictEqual(D.cash(repaired), 53);
});