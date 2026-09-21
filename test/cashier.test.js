/* DEKKAN CORE — per-cashier attribution: every sale entry remembers who rang it,
   and the day report splits the day per cashier. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shop() {
  let s = D.createShop({ name: 'X', startCash: 100 });
  s = D.addProduct(s, { name: 'Cola', buy: 0.5, sell: 1.5, stock: 20 });
  s = D.addProduct(s, { name: 'Bread', buy: 0.2, sell: 0.5, stock: 50 });
  return s;
}


test('sale remembers the cashier who rang it', () => {
  const sh = shop();
  const s = D.sell(sh, { items: [{ id: sh.products[0].id, qty: 2 }], paid: 3, who: 'Amine' });
  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.kind, 'sale');
  assert.strictEqual(e.who, 'Amine');
});

test('sale without a cashier has no who (legacy entries stay clean)', () => {
  const sh = shop();
  const s = D.sell(sh, { items: [{ id: sh.products[0].id, qty: 1 }], paid: 1.5 });
  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.who, undefined);
});

test('credit sale keeps the cashier too', () => {
  const sh = shop();
  const s = D.sell(sh, { items: [{ id: sh.products[0].id, qty: 1 }], customer: 'Ali', who: 'Amine' });
  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.who, 'Amine');
});

test('sellFree tags the entry', () => {
  const s = D.sellFree(shop(), { name: 'Coffee', qty: 1, price: 1, paid: 1, who: 'Samir' });
  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.who, 'Samir');
});

test('sellAll (full basket) tags one entry for all of it', () => {
  const sh = shop();
  const s = D.sellAll(sh, { items: [{ id: sh.products[0].id, qty: 1 }, { id: sh.products[1].id, qty: 2 }], free: [{ name: 'Bags', price: 0.1, qty: 1 }], paid: 10, who: 'Amine' });
  const sales = s.day.entries.filter(e => e.kind === 'sale');
  assert.strictEqual(sales.length, 1);
  assert.strictEqual(sales[0].who, 'Amine');
});

test('day report splits sales per cashier: count + total, richest first', () => {
  let sh = shop();
  const id = sh.products[0].id;
  sh = D.sell(sh, { items: [{ id, qty: 1 }], paid: 10, who: 'Amine' });   // 1.5
  sh = D.sell(sh, { items: [{ id, qty: 2 }], paid: 10, who: 'Samir' });   // 3
  sh = D.sell(sh, { items: [{ id, qty: 3 }], paid: 10, who: 'Amine' });   // 4.5 -> Amine total 6
  sh = D.sell(sh, { items: [{ id, qty: 1 }], paid: 10 });                 // no cashier (ignored)
  const by = D.stats(sh).byCashier;
  assert.strictEqual(by.length, 2);
  assert.strictEqual(by[0].who, 'Amine');   // 6 > 3: richest first
  assert.strictEqual(by[0].count, 2);
  assert.strictEqual(by[0].total, 6);
  assert.strictEqual(by[1].who, 'Samir');
  assert.strictEqual(by[1].count, 1);
  assert.strictEqual(by[1].total, 3);
});

test('byCashier is empty when nobody is named', () => {
  const sh = shop();
  const s = D.sell(sh, { items: [{ id: sh.products[0].id, qty: 1 }], paid: 1.5 });
  assert.deepStrictEqual(D.stats(s).byCashier, []);
});

test('report entries expose the cashier', () => {
  const sh = shop();
  const s = D.sell(sh, { items: [{ id: sh.products[0].id, qty: 1 }], paid: 1.5, who: 'Amine' });
  const es = D.stats(s).entries;
  const e = es[es.length - 1];
  assert.strictEqual(e.who, 'Amine');
  assert.strictEqual(e.kind, 'sale');
});

test('cashier registry remembers names, most recent first', () => {
  let sh = shop();
  const id = sh.products[0].id;
  sh = D.sell(sh, { items: [{ id, qty: 1 }], paid: 1.5, who: 'Amine' });
  sh = D.sell(sh, { items: [{ id, qty: 1 }], paid: 1.5, who: 'Samir' });
  sh = D.sell(sh, { items: [{ id, qty: 1 }], paid: 1.5, who: 'amine' }); // case-insensitive, jumps to top
  assert.deepStrictEqual(D.cashierNames(sh), ['amine', 'Samir']);
});

test('sale without cashier leaves the registry untouched', () => {
  const sh = shop();
  D.sell(sh, { items: [{ id: sh.products[0].id, qty: 1 }], paid: 1.5 });
  assert.deepStrictEqual(D.cashierNames(sh), []);
});