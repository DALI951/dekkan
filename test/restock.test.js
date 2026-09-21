/* DEKKAN CORE — restock needs: which products are past/below their alert line,
   and how many units to order to get back to DOUBLE the threshold. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shopWith(products) {
  let s = D.createShop({ name: 'Test', startCash: 100 });
  for (const p of products) s = D.addProduct(s, p);
  return s;
}

test('healthy stock needs nothing', () => {
  const s = shopWith([{ name: 'Cola', buy: 0.8, sell: 1.5, stock: 30, lowAt: 10 }]);
  assert.deepStrictEqual(D.restockNeed(s), []);
});

test('a product below its alert line needs enough to reach 2x the threshold', () => {
  const s = shopWith([
    { name: 'Cola', buy: 0.8, sell: 1.5, stock: 4, lowAt: 10 }   // need 20 - 4 = 16
  ]);
  const n = D.restockNeed(s)[0];
  assert.strictEqual(n.name, 'Cola');
  assert.strictEqual(n.stock, 4);
  assert.strictEqual(n.lowAt, 10);
  assert.strictEqual(n.need, 16);
});

test('products exactly ON the alert line are included', () => {
  const s = shopWith([{ name: 'Cola', buy: 0.8, sell: 1.5, stock: 10, lowAt: 10 }]);
  assert.strictEqual(D.restockNeed(s)[0].need, 10);
});

test('products with no alert line (lowAt 0) never appear', () => {
  const s = shopWith([{ name: 'Cola', buy: 0.8, sell: 1.5, stock: 0, lowAt: 0 }]);
  assert.deepStrictEqual(D.restockNeed(s), []);
});

test('most urgent first: the product with least stock on top', () => {
  const s = shopWith([
    { name: 'Gone', buy: 1, sell: 2, stock: 1, lowAt: 10 },     // need 19
    { name: 'Ok-ish', buy: 1, sell: 2, stock: 9, lowAt: 10 },   // need 11
    { name: 'Fine', buy: 1, sell: 2, stock: 10, lowAt: 10 }     // need 10
  ]);
  const n = D.restockNeed(s);
  assert.deepStrictEqual(n.map(x => x.name), ['Gone', 'Ok-ish', 'Fine']);
  assert.deepStrictEqual(n.map(x => x.need), [19, 11, 10]);
});

test('selling past the alert line makes a product appear on the need list', () => {
  let s = shopWith([{ name: 'Cola', buy: 0.8, sell: 1.5, stock: 10, lowAt: 5 }]);
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 6 }] });   // stock 10 -> 4, past the line of 5
  assert.deepStrictEqual(D.restockNeed(s)[0], {
    id, name: 'Cola', stock: 4, lowAt: 5, need: 6
  });
});