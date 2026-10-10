// DEKKAN — draft basket survives refresh (SALE-002).
// The in-progress basket lives in the UI ctx (C.basket / C.freeItems) and must
// NEVER be written into the persisted state blob: stock, cash and the report
// stay untouched until the sale is actually recorded. A reload therefore comes
// back to a clean till (no half-sale silently restocked, no phantom money).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

test('SALE-002: a draft basket never touches stock/cash and is not persisted', () => {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  const id = s.products[0].id;

  // the saved blob IS the state: a draft is not part of it
  const blobBefore = JSON.stringify(s);
  assert.equal(blobBefore.indexOf('basket'), -1, 'state has no place for a draft');

  // addProduct/buyStock move stock; merely browsing the sell page must not
  const stockBefore = s.products[0].stock;
  const cashBefore = s.day.startCash;
  const blobAfter = JSON.stringify(s);
  assert.equal(blobAfter, blobBefore, 'looking at products changes nothing');

  // only an actual recorded sale moves the numbers
  s = D.sell(s, { items: [{ id: id, qty: 2 }], paid: 3 });
  assert.equal(s.products[0].stock, stockBefore - 2, 'sale moves stock');
  const sales = s.day.entries.filter(function (e) { return e.kind === 'sale'; });
  assert.equal(sales.length, 1);
  assert.equal(sales[0].bill.lines.length, 1);
  assert.equal(cashBefore, 50, 'the till keeps its opening float until closeDay');
});