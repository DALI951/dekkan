// DEKKAN CORE tests — prove THE ALGORITHM holds.
// Run: node --test test/

'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

// helper: a fresh shop with two products
function shop() {
  let s = D.createShop({ name: 'Cafe Ben Arous', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca 33cl', buy: 0.8, sell: 1.5, stock: 10, lowAt: 3 });
  s = D.addProduct(s, { name: 'Pain', buy: 0.4, sell: 1, stock: 20, lowAt: 5 });
  return s;
}

test('createShop: cash starts at startCash, zero entries', () => {
  const s = D.createShop({ startCash: 50 });
  assert.equal(s.day.startCash, 50);
  assert.equal(s.day.entries.length, 0);
  assert.equal(D.cash(s), 50);
});

// ==== cash identity: cash ALWAYS = startCash + sum(entries.amount) ====
test('cash identity holds after every kind of movement', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }] });      // +3.00
  s = D.buyStock(s, s.products[1].id, 10, 0.8);                      // -8.00
  s = D.expense(s, { amount: 5, note: 'electricity' });              // -5.00
  s = D.income(s, { amount: 20, note: 'from home' });                // +20.00
  s = D.addDebt(s, { name: 'Ahmed', amount: 4 });                    // owed 4
  const debtId = s.debts[0].id;
  s = D.payDebt(s, debtId, { amount: 4 });                           // +4.00

  const expected = 50 + 3 - 8 - 5 + 20 + 4;
  assert.equal(D.cash(s), expected);
  // airtight: recompute from entries
  let fromEntries = s.day.startCash;
  for (const e of s.day.entries) fromEntries += e.amount;
  assert.equal(fromEntries, expected);
});

// ==== stock ====
test('selling decreases stock, buying increases it; stock never goes negative', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 4 }] });
  assert.equal(D.getProduct(s, s.products[0].id).stock, 6);
  assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: 7 }] }), /not enough stock/);
  // the failed sale changed NOTHING
  assert.equal(D.getProduct(s, s.products[0].id).stock, 6);
  s = D.buyStock(s, s.products[0].id, 10, 0.8);
  assert.equal(D.getProduct(s, s.products[0].id).stock, 16);
});

test('insufficient-stock sale leaves cash and soldCost untouched', () => {
  let s = shop();
  const before = D.cash(s);
  assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: 99 }] }), /not enough stock/);
  assert.equal(D.cash(s), before);
  assert.equal(s.day.soldCost, 0);
});

// ==== multi-product basket + profit line ====
test('basket sells several products and tracks cost of goods sold', () => {
  let s = shop();
  s = D.sell(s, { items: [
    { id: s.products[0].id, qty: 2 },  // coca 2*1.5 = 3.00,  cost 2*0.8 = 1.60
    { id: s.products[1].id, qty: 5 }   // pain 5*1   = 5.00,  cost 5*0.4 = 2.00
  ] });
  const st = D.stats(s);
  assert.equal(st.daySales, 8);
  assert.equal(st.costOfSold, 3.6);
  assert.equal(st.dayProfit, 8 - 3.6);
  assert.equal(D.cash(s), 50 + 8);
});

test('sell with a custom price override (negotiated / old price)', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 1, price: 1.2 }] });
  const st = D.stats(s);
  assert.equal(st.daySales, 1.2);   // not the catalog 1.5
  assert.equal(st.costOfSold, 0.8); // cost stays at buy price
  assert.equal(st.dayProfit, 0.4);
});

// ==== free items (no stock) ====
test('sellFree sells services/items without stock tracking, profit zero cost', () => {
  let s = shop();
  s = D.sellFree(s, { name: 'Café maçon', price: 1.2, qty: 2 });
  const st = D.stats(s);
  assert.equal(st.daySales, 2.4);
  assert.equal(st.costOfSold, 0); // nothing came out of stock
});

// ==== full profit formula: sales - cost - buys - expenses ====
test('dayProfit = sales - costOfSold - buys - expenses', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 10 }] });   // +15, cost 8
  s = D.expense(s, { amount: 2, note: 'water' });                  // -2
  const st = D.stats(s);
  assert.equal(st.daySales, 15);
  assert.equal(st.costOfSold, 8);
  assert.equal(st.dayExpenses, 2);
  assert.equal(st.dayProfit, 15 - 8 - 2);
});

// ==== debts (the notebook) ====
test('credit sale: cash does NOT move, debt grows', () => {
  let s = shop();
  const cocaId = s.products[0].id;
  s = D.sell(s, { items: [{ id: cocaId, qty: 3 }], creditTo: 'Samir' }); // 4.5 on credit
  assert.equal(D.cash(s), 50);                        // money untouched
  assert.equal(s.debts.length, 1);
  assert.equal(s.debts[0].total, 4.5);
  assert.equal(s.debts[0].paid, 0);
  assert.equal(D.debtsOwed(s), 4.5);
});

test('same customer second credit sale merges into the same open debt', () => {
  let s = shop();
  const cocaId = s.products[0].id;
  s = D.sell(s, { items: [{ id: cocaId, qty: 2 }], creditTo: 'Samir' });
  s = D.sell(s, { items: [{ id: cocaId, qty: 2 }], creditTo: 'Samir' });
  assert.equal(s.debts.length, 1);
  assert.equal(s.debts[0].total, 6);
});

test('partial payments: cash in on each pay, settled only when fully paid, no overpay', () => {
  let s = shop();
  const cocaId = s.products[0].id;
  s = D.sell(s, { items: [{ id: cocaId, qty: 2 }], creditTo: 'Samir' }); // owes 3
  const debtId = s.debts[0].id;
  s = D.payDebt(s, debtId, { amount: 1 });
  assert.equal(D.cash(s), 51);
  assert.equal(s.debts[0].paid, 1);
  assert.equal(s.debts[0].settled, false);
  assert.equal(D.debtsOwed(s), 2);
  s = D.payDebt(s, debtId, { amount: 99 }); // overpay -> clamps to 2
  assert.equal(D.cash(s), 53);
  assert.equal(s.debts[0].paid, 3);
  assert.equal(s.debts[0].settled, true);
  assert.equal(D.debtsOwed(s), 0);
});

// ==== stock buy + debt interlock ====
test('debt payment counts as revenue in today profit', () => {
  let s = shop();
  const cocaId = s.products[0].id;
  s = D.sell(s, { items: [{ id: cocaId, qty: 2 }], creditTo: 'Samir' }); // 3 debt, 0 cash
  const debtId = s.debts[0].id;
  s = D.payDebt(s, debtId, { amount: 3 });
  const st = D.stats(s);
  assert.equal(st.daySales, 3);   // debt payments = real money today
  assert.equal(st.dayProfit, 3 - 1.6);
});

// ==== day rollover ====
test('closeDay: closes the day with endCash, new day starts with that cash', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }] }); // +3 -> 53
  s = D.closeDay(s);
  assert.equal(s.days.length, 1);
  assert.equal(s.days[0].endCash, 53);
  assert.equal(s.day.startCash, 53);   // rolling over
  assert.equal(s.day.entries.length, 0);
  assert.equal(s.day.soldCost, 0);
  assert.equal(D.cash(s), 53);
  // second sale lands in the NEW day
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 1 }] });
  assert.equal(D.cash(s), 54.5);
  assert.equal(s.days.length, 1);      // only the first day closed
});

// ==== product rules ====
test('products need a name and a sell price', () => {
  let s = shop();
  assert.throws(() => D.addProduct(s, { name: '', sell: 1 }), /name/);
  assert.throws(() => D.addProduct(s, { name: 'X' }), /sell price/);
});

test('removeProduct only when stock is zero', () => {
  let s = shop();
  assert.throws(() => D.removeProduct(s, s.products[0].id), /stock/);
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 10 }] }); // drain it
  s = D.removeProduct(s, s.products[0].id);
  assert.equal(s.products.length, 1);
});

// ==== inventory value & low stock ====
test('inventory value = sum(stock * buy); low stock list flags thresholds', () => {
  let s = shop();
  const coca = s.products[0]; // 10 * 0.8 = 8, lowAt 3
  s = D.sell(s, { items: [{ id: coca.id, qty: 8 }] }); // 2 left <= 3 -> low
  const st = D.stats(s);
  assert.equal(st.inventoryValue, 2 * 0.8 + 20 * 0.4); // 9.6
  assert.equal(st.lowStock.length, 1);
  assert.equal(st.lowStock[0].name, 'Coca 33cl');
});

// ==== immutability ====
test('every op returns a NEW state; the old one stays frozen', () => {
  let s = shop();
  const before = JSON.stringify(s);
  const s2 = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }] });
  assert.equal(JSON.stringify(s), before, 'original state untouched');
  assert.notEqual(s2, s);
  assert.equal(D.cash(s2), 53);
});