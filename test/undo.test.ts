/* CORE — undo last sale: the fat-finger safety valve. Reverses a sale entry
 * completely (cash, stock, sold-costs, and any debt it created/added) but ONLY
 * when it is the very last action of the day — nothing may have happened after
 * it, so the reversal can never corrupt later numbers.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shopWith(products) {
  let s = D.createShop({ name: 'Test', startCash: 50 });
  for (const p of products) s = D.addProduct(s, p);
  return s;
}
const COLA = { name: 'Cola', buy: 0.8, sell: 1.5, stock: 10 };

test('undo a CASH sale: till back, stock back, sold costs back, entry gone', () => {
  let s = shopWith([COLA]);
  const pid = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: pid, qty: 2 }] });
  assert.strictEqual(D.cash(s), 53, 'after sale: 50 + 3');
  assert.strictEqual(s.products[0].stock, 8);

  assert.strictEqual(D.canUndoSale(s), true);
  s = D.undoLastSale(s);

  assert.strictEqual(D.cash(s), 50, 'till back to the starting 50');
  assert.strictEqual(s.products[0].stock, 10, 'stock restored');
  assert.strictEqual(s.day.soldCost, 0, 'sold cost restored');
  assert.strictEqual(s.day.entries.length, 0, 'no entries left');
  assert.strictEqual(s.day.soldByProduct[pid], undefined, 'product refund budget restored');
  assert.strictEqual(D.canUndoSale(s), false, 'nothing left to undo');
});

test('undo a CREDIT sale: the whole debt it created disappears', () => {
  let s = shopWith([COLA]);
  const pid = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: pid, qty: 2 }], customer: 'Ali' });
  assert.strictEqual(D.debtsOwed(s), 3);
  assert.strictEqual(D.cash(s), 50, 'credit moved no cash');

  s = D.undoLastSale(s);

  assert.strictEqual(D.debtsOwed(s), 0, 'the created debt is gone');
  assert.strictEqual(D.cash(s), 50);
  assert.strictEqual(s.products[0].stock, 10);
});

test('undo a PARTIAL sale: cash AND debt both revert', () => {
  let s = shopWith([COLA]);
  const pid = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: pid, qty: 6 }], customer: 'Ali', paid: 4 }); // 9 net, 4 cash, 5 debt
  assert.strictEqual(D.cash(s), 54);
  assert.strictEqual(D.debtsOwed(s), 5);

  s = D.undoLastSale(s);
  assert.strictEqual(D.cash(s), 50);
  assert.strictEqual(D.debtsOwed(s), 0);
  assert.strictEqual(s.products[0].stock, 10);
});

test('undo a second credit on the SAME customer only removes that part', () => {
  let s = shopWith([COLA]);
  const pid = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: pid, qty: 1 }], customer: 'Ali' });   // debt 1.5
  s = D.sellAll(s, { items: [{ id: pid, qty: 1 }], customer: 'Ali' });   // debt 3.0
  assert.strictEqual(D.debtsOwed(s), 3);

  s = D.undoLastSale(s);
  assert.strictEqual(D.debtsOwed(s), 1.5, 'only the LAST sale came off the debt');
  assert.strictEqual(s.products[0].stock, 9, 'one cola came back');
});

test('a sale with FREE items undoes cleanly too', () => {
  let s = shopWith([COLA]);
  const pid = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: pid, qty: 2 }], free: [{ name: 'Coffee', price: 0.5, qty: 2 }] });
  assert.strictEqual(D.cash(s), 54, '3 + 1 = 4 net');
  s = D.undoLastSale(s);
  assert.strictEqual(D.cash(s), 50);
  assert.strictEqual(s.day.soldFree['Coffee'], undefined);
  assert.strictEqual(s.day.soldCost, 0);
});

test('canUndoSale is false when the day is empty or the last action is not a sale', () => {
  let s = shopWith([COLA]);
  assert.strictEqual(D.canUndoSale(s), false, 'empty day');

  const pid = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: pid, qty: 1 }], customer: 'Ali' }); // credit 1.5
  s = D.payDebt(s, s.debts[0].id, { amount: 1 });                      // debt-pay after
  assert.strictEqual(D.canUndoSale(s), false, 'a later payment blocks undo');

  s = shopWith([COLA]); // fresh: a refund after a sale also blocks
  const p2 = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: p2, qty: 1 }] });
  s = D.refund(s, { items: [{ id: p2, qty: 1 }] });
  assert.strictEqual(D.canUndoSale(s), false, 'a later refund blocks undo');
});

test('undo trips the day rollover guard: only TODAYS last sale', () => {
  let s = shopWith([COLA]);
  const pid = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: pid, qty: 1 }] });   // today: sale of 1.5
  // simulate the shop being opened "tomorrow": the sale now belongs to a CLOSED day
  s.day.date = '2000-01-01'; // fake an old open day (rollover closes it on next action)
  s = D.rollover(s);
  assert.strictEqual(s.days.length, 1, 'yesterday was closed into history');
  assert.strictEqual(s.days[0].entries.length, 1, 'the sale is frozen in the past day');
  assert.strictEqual(D.canUndoSale(s), false, 'the sale belongs to the closed day �?" not undoable');
});