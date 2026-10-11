/* CUST-001 — the WALK-IN rule, frozen in writing.
 *
 * A walk-in (an anonymous sale: no name typed) is STILL a customer of the day:
 * it takes the next client # and pays normally. But it must NEVER create a
 * customer record. Three walk-ins are three client #s — not one shared
 * "walk-in" client. This test is the wall against a regression into
 * "one customer record per anonymous sale".
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

function shop() {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 20 });
  return s;
}
function pid(s) { return s.products[0].id; }

test('CUST-001: an anonymous sale is the day\'s next client #, never a saved customer', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: pid(s), qty: 1 }], paid: 1.5 }); // walk-in #1
  assert.strictEqual(D.nextClientNo(s), 2, 'the walk-in still took client #1');
  assert.deepStrictEqual(D.customerNames(s), [], 'no name typed -> nobody remembered');
  assert.strictEqual(s.customers.length, 0, 'no customer record invented');
  assert.strictEqual(D.cash(s), 51.5, 'the walk-in paid normally');
});

test('CUST-001: three walk-ins are three client #s, not one shared customer', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: pid(s), qty: 1 }], paid: 1.5 }); // #1
  s = D.sellAll(s, { items: [{ id: pid(s), qty: 1 }], paid: 1.5 }); // #2
  s = D.sellAll(s, { free: [{ name: 'Cafe', price: 1, qty: 1 }] }); // #3 (still a client)
  const sales = D.dayReport(s).entries.filter(function (e) { return e.kind === 'sale'; });
  assert.strictEqual(sales.length, 3, 'three sales landed');
  assert.deepStrictEqual(sales.map(function (e) { return e.no; }), [1, 2, 3], 'each anonymous sale is its own client #');
  assert.strictEqual(s.customers.length, 0, 'still no customer records');
  assert.deepStrictEqual(D.customerNames(s), [], 'the registry stays empty for walk-ins');
  assert.strictEqual(D.nextClientNo(s), 4, 'and the counter moved on');
});

test('CUST-001: a named sale between walk-ins is the only saved customer', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: pid(s), qty: 1 }], paid: 1.5 });                      // walk-in #1
  s = D.sellAll(s, { free: [{ name: 'Cafe', price: 2, qty: 1 }], customer: 'Ali' });     // #2, named
  s = D.sellAll(s, { items: [{ id: pid(s), qty: 1 }], paid: 1.5 });                      // walk-in #3
  assert.deepStrictEqual(D.customerNames(s), ['Ali'], 'only the named buyer is remembered');
  assert.strictEqual(s.customers.length, 1, 'exactly one customer record');
  assert.strictEqual(D.nextClientNo(s), 4, 'walk-ins kept counting alongside the name');
});
