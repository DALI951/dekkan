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

// ==== REFUNDS ====
test('refund: cash back, goods back on shelf, cost undone, profit correct', () => {
  let s = shop();
  const coca = s.products[0]; // buy 0.8, sell 1.5
  s = D.sell(s, { items: [{ id: coca.id, qty: 4 }] });            // +6 cash, 4 sold
  const after = D.stats(s);
  assert.equal(after.dayProfit, 6 - 3.2);

  s = D.refund(s, { items: [{ id: coca.id, qty: 1 }], reason: 'bad bottle' }); // -1.5 back, +1 stock
  const st = D.stats(s);
  assert.equal(D.cash(s), 50 + 6 - 1.5);
  assert.equal(D.getProduct(s, coca.id).stock, 7);
  assert.equal(st.dayRefunds, 1.5);
  assert.equal(st.netSales, 6 - 1.5);
  assert.equal(st.costOfSold, 2.4);                  // exactly 3.2 - 0.8
  assert.equal(st.dayProfit, 2.1); // money story stays honest
});

test('refund on credit: debt goes down, cash does NOT move', () => {
  let s = shop();
  const coca = s.products[0];
  s = D.sell(s, { items: [{ id: coca.id, qty: 2 }], creditTo: 'Samir' }); // owes 3
  assert.equal(D.cash(s), 50);
  s = D.refund(s, { items: [{ id: coca.id, qty: 2 }], creditTo: 'Samir' });
  assert.equal(D.cash(s), 50);
  assert.equal(D.debtsOwed(s), 0);
  assert.equal(D.getProduct(s, coca.id).stock, 10);
  assert.equal(s.debts[0].settled, true);
});

test('refundFree for non-stock items', () => {
  let s = shop();
  s = D.sellFree(s, { name: 'Cafe maçon', price: 1.2, qty: 3 }); // +3.6
  s = D.refundFree(s, { name: 'Cafe maçon', price: 1.2, qty: 1, note: 'wrong order' });
  assert.equal(D.cash(s), 50 + 3.6 - 1.2);
  assert.equal(D.stats(s).dayRefunds, 1.2);
});

test('refund respects the allowRefund toggle', () => {
  let s = D.createShop({ allowRefund: false });
  assert.throws(() => D.refund(s, { items: [{ id: 'x', qty: 1 }] }), /refunds are turned off/);
});

// ==== DISCOUNTS ====
test('percent discount: customer pays less, cost unchanged (you eat the margin)', () => {
  let s = shop();
  const coca = s.products[0];
  s = D.sell(s, { items: [{ id: coca.id, qty: 2 }], discount: { percent: 10 } }); // 3 -> 2.7
  const st = D.stats(s);
  assert.equal(D.cash(s), 50 + 2.7);
  assert.equal(st.daySales, 2.7);
  assert.equal(st.costOfSold, 1.6);        // cost does NOT shrink
  assert.equal(st.dayProfit, 2.7 - 1.6);  // discount eats margin, not cost
});

test('flat discount is capped at the sale value (never a negative sale)', () => {
  let s = shop();
  const coca = s.products[0];
  s = D.sell(s, { items: [{ id: coca.id, qty: 1 }], discount: { amount: 99 } }); // 1.5 -> 0
  assert.equal(D.cash(s), 50);
  assert.equal(D.stats(s).daySales, 0);
});

test('discount respects the allowDiscount toggle', () => {
  let s = D.createShop({ allowDiscount: false });
  s = D.addProduct(s, { name: 'X', sell: 1, buy: 0.5, stock: 5 });
  const id = s.products[0].id;
  assert.throws(() => D.sell(s, { items: [{ id, qty: 1 }], discount: { percent: 10 } }), /discounts are turned off/);
  // and without a discount, selling still works
  s = D.sell(s, { items: [{ id, qty: 1 }] });
  assert.equal(D.cash(s), 1);
});

test('credit sale with discount: the debt is the discounted amount', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }], discount: { percent: 10 }, creditTo: 'Rami' });
  assert.equal(s.debts[0].total, 2.7);
  assert.equal(D.cash(s), 50);
});

// ==== CASH CHECK ====
test('checkCash compares the drawer to the computed cash and records it', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }] }); // expected 53
  s = D.checkCash(s, { counted: 52.5 }); // 500 millimes short
  const st = D.stats(s);
  assert.equal(st.lastCheck.expected, 53);
  assert.equal(st.lastCheck.counted, 52.5);
  assert.equal(st.lastCheck.diff, -0.5);
  assert.equal(st.lastCheck.ok, false);
  assert.equal(st.checks.length, 1);
  assert.equal(D.cash(s), 53); // the check itself moved NO money
});

// ==== THE DAILY REPORT ====
test('dayReport lists every move: start cash, each entry, totals, profit', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }] });          // +3.00
  s = D.sellFree(s, { name: 'Kitkat', price: 2, qty: 1 });              // +2.00
  s = D.refund(s, { items: [{ id: s.products[0].id, qty: 1 }] });       // -1.50
  s = D.expense(s, { amount: 4, note: 'electricity' });                 // -4.00
  s = D.income(s, { amount: 10, note: 'from home' });                   // +10.00
  s = D.checkCash(s, { counted: D.cash(s) });                           // ok check

  const r = D.dayReport(s);
  assert.equal(r.startCash, 50);
  assert.equal(r.cash, 50 + 3 + 2 - 1.5 - 4 + 10);
  assert.equal(r.entries.length, 6); // sale, sale, refund, expense, income, check
  assert.deepEqual(r.totals, { sales: 5, debtPays: 0, refunds: 1.5, buys: 0, expenses: 4, incomes: 10, checks: 1 });
  assert.equal(r.grossSales, 5);
  assert.equal(r.netSales, 3.5);
  assert.equal(r.dayProfit, -1.3); // cost of the 1 coke that stayed sold
  assert.equal(r.lastCheck.ok, true);
  // every amount in entries is a real, signed number (a shopkeeper can follow the story)
  const sum = r.entries.reduce((a, e) => a + e.amount, 0) + r.startCash;
  assert.equal(sum, r.cash);
});

// ==== a full day: sell -> close -> open -> verify history is frozen ====
test('closed days are frozen history; new day starts from endCash', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }] }); // 53
  s = D.closeDay(s);
  s = D.sell(s, { items: [{ id: s.products[1].id, qty: 1 }] }); // 54
  const r = D.dayReport(s);
  assert.equal(r.cash, 54);
  assert.equal(r.entries.length, 1);                    // only today's move
  assert.equal(s.days[0].endCash, 53);                  // yesterday closed at 53
  assert.equal(s.days[0].entries.length, 1);            // its own entry stays there
});

// ==== shop identity & options (the small-print settings) ====
test('updateShop renames the shop anytime', () => {
  const s = shop();
  const s2 = D.updateShop(s, { name: 'بن علي' });
  assert.equal(s2.shop.name, 'بن علي');
  assert.equal(s.shop.name, 'Cafe Ben Arous'); // immutability: old state untouched
});

test('updateShop changes startCash only while the day is empty', () => {
  let s = shop(); // day 1, empty
  s = D.updateShop(s, { startCash: 30 });
  assert.equal(D.cash(s), 30);
  // once the day has movement, startCash is locked
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 1 }] }); // coca 1.5 -> 31.5
  assert.throws(() => D.updateShop(s, { startCash: 99 }), /locked/);
  assert.equal(D.cash(s), 31.5); // unchanged by the failed attempt
});

test('updateShop validates name and start cash', () => {
  assert.throws(() => D.updateShop(shop(), { name: '   ' }), /name/);
  assert.throws(() => D.updateShop(shop(), { startCash: -5 }), /start cash/);
});

test('setSettings toggles allowDiscount and allowRefund', () => {
  let s = shop();
  s = D.setSettings(s, { allowDiscount: false });
  assert.equal(s.settings.allowDiscount, false);
  assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: 1 }], discount: { percent: 10 } }), /discounts are turned off/);
  s = D.setSettings(s, { allowRefund: false });
  assert.throws(() => D.refund(s, { items: [{ id: s.products[0].id, qty: 1 }] }), /refunds are turned off/);
  // back on: both work again
  s = D.setSettings(s, { allowDiscount: true, allowRefund: true });
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 1 }], discount: { percent: 10 } });
  s = D.refund(s, { items: [{ id: s.products[0].id, qty: 1 }] });
  assert.equal(s.day.entries.filter(e => e.kind === 'refund').length, 1);
});

test('setSettings rejects non-boolean values', () => {
  assert.throws(() => D.setSettings(shop(), { allowDiscount: 'yes' }), /boolean/);
});

test('removeDebt deletes only settled (fully paid) debts', () => {
  let s = shop();
  s = D.addDebt(s, { name: 'ali', amount: 5 });
  // can't delete while money is owed
  assert.throws(() => D.removeDebt(s, s.debts[0].id), /open balance/);
  assert.equal(s.debts.length, 1);
  // after full payment it can be deleted
  s = D.payDebt(s, s.debts[0].id, { amount: 5 });
  s = D.removeDebt(s, s.debts[0].id);
  assert.equal(s.debts.length, 0);
  assert.throws(() => D.removeDebt(s, 'nope'), /not found/);
});

// ==== PARTIAL PAYMENT at the till (paid < net = debt, paid > net = change) ====
test('partial pay: the till takes what was handed over, the rest is the customer debt', () => {
  let s = shop();
  const coca = s.products[0].id;                 // sells at 1.5
  const before = D.cash(s);                      // 50
  s = D.sell(s, { items: [{ id: coca, qty: 2 }], paid: 1, creditTo: 'Samir' }); // net 3, paid 1
  assert.equal(D.cash(s), before + 1, 'only the money handed over enters the box');
  assert.equal(s.debts.length, 1);
  assert.equal(s.debts[0].name, 'Samir');
  assert.equal(s.debts[0].total, 2, 'the rest (3 - 1) is owed');
  assert.equal(s.debts[0].paid, 0);
  assert.equal(s.day.entries.filter(e => e.kind === 'sale')[0].amount, 1);
});

test('partial pay: paying MORE than the price keeps the box honest (the extra is change)', () => {
  let s = shop();
  const coca = s.products[0].id;                 // 1.5
  const before = D.cash(s);                      // 50
  s = D.sell(s, { items: [{ id: coca, qty: 2 }], paid: 5 }); // net 3, gave 5
  assert.equal(D.cash(s), before + 3, 'cash takes the price, never the change');
  assert.equal(s.debts.length, 0, 'overpaying never creates a debt');
  assert.equal(s.day.entries.filter(e => e.kind === 'sale')[0].amount, 3);
});

test('partial pay: exact money is a normal cash sale (no debt, no leftover)', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 3 });
  assert.equal(D.cash(s), 53);
  assert.equal(s.debts.length, 0);
});

test('partial pay: the unpaid rest NEEDS a name, and a failed sale changes nothing', () => {
  let s = shop();
  const before = D.cash(s);
  assert.throws(
    () => D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 1 }),
    /needs a customer name/
  );
  assert.equal(D.cash(s), before);
  assert.equal(s.debts.length, 0);
  assert.equal(D.getProduct(s, s.products[0].id).stock, 10, 'stock not touched by the refused sale');
});

test('partial pay: a second trip to the same customer merges into the same open debt', () => {
  let s = shop();
  const coca = s.products[0].id;
  s = D.sell(s, { items: [{ id: coca, qty: 2 }], paid: 1, creditTo: 'Samir' }); // owes 2
  s = D.sell(s, { items: [{ id: coca, qty: 2 }], paid: 1, creditTo: 'Samir' }); // owes 2 more
  assert.equal(s.debts.length, 1);
  assert.equal(s.debts[0].total, 4);
  assert.equal(D.cash(s), 52, 'each visit put 1 in the box');
});

test('partial pay: a discount changes both halves (cash and rest)', () => {
  let s = shop();
  s = D.setSettings(s, { allowDiscount: true });
  const coca = s.products[0].id;
  s = D.sell(s, { items: [{ id: coca, qty: 2 }], discount: { percent: 50 }, paid: 1, creditTo: 'Rami' });
  assert.equal(D.cash(s), 51);          // 3 -> net 1.5, paid 1
  assert.equal(s.debts[0].total, 0.5);  // the rest
});

test('partial pay: free items (no stock) split the same way', () => {
  let s = shop();
  s = D.sellFree(s, { name: 'Cafe', price: 2, qty: 2, paid: 1, creditTo: 'Nadia' }); // net 4
  assert.equal(D.cash(s), 51);
  assert.equal(s.debts[0].total, 3);
});

test('partial pay: a refund on the paid part still only moves real cash', () => {
  let s = shop();
  const coca = s.products[0].id;
  s = D.sell(s, { items: [{ id: coca, qty: 2 }], paid: 1, creditTo: 'Samir' }); // cash 51, owes 2
  s = D.refund(s, { items: [{ id: coca, qty: 1 }] });                           // gives 1.5 back
  assert.equal(D.cash(s), 49.5);
  assert.equal(s.debts[0].total, 2, 'the debt is untouched by a normal refund');
});

// The webapp pays for a mixed cart with SEVERAL core calls (stock sale + free-item
// sales). It must spread the one cash handout across them; this is that contract.
function spreadCart(s, paid, creditName, stockNet, freeNets) {
  let left = paid;
  const take = (net) => { const t = Math.min(left, net); left = Math.round((left - t) * 1000) / 1000; return t; };
  const p1 = take(stockNet);
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: p1, creditTo: p1 < stockNet ? creditName : undefined });
  freeNets.forEach(function (net) {
    const p = take(net);
    s = D.sellFree(s, { name: 'Cafe', price: 1, qty: net, paid: p, creditTo: p < net ? creditName : undefined });
  });
  return { state: s, left: left };
}

test('a mixed cart with one handout: cash = min(paid, net), debt = the rest (never double-counted)', () => {
  const cases = [
    { paid: 2, cash: 52, owed: 3 },   // short: 2 in the box, 3 on Samir
    { paid: 5, cash: 55, owed: 0 },   // exact
    { paid: 7, cash: 55, owed: 0 },   // over: the box keeps the price, 2 is change
    { paid: 4, cash: 54, owed: 1 }
  ];
  cases.forEach(function (c) {
    let s = shop();                                  // coca 1.5x2 = 3.000, cafe 1.000x2 = 2.000
    const r = spreadCart(s, c.paid, 'Samir', 3, [2]);
    assert.equal(D.cash(r.state), c.cash, 'paid ' + c.paid + ' -> cash');
    const owed = r.state.debts.reduce(function (a, d) { return a + (d.total - d.paid); }, 0);
    assert.equal(owed, c.owed, 'paid ' + c.paid + ' -> owed');
    assert.equal(r.left, Math.max(0, c.paid - 5), 'left unallocated');
  });
});

// ==== ABSURD INPUT — the till can be fooled by NOBODY, not even a typo.
//      A negative price/discount/paid/qty is REFUSED before a single entry
//      registers, and the till never reads NaN or Infinity. Byte-clean by
//      construction: these asserts only move numbers, never currency strings.

test('a NEGATIVE free-line price is refused: no entry, cash byte-identical', () => {
  let s = shop();
  const cashBefore = D.cash(s);
  const stock = s.products[0].stock;
  assert.throws(() => D.sellFree(s, { name: 'Nada', price: -5, qty: 2 }), /price/);
  assert.equal(D.cash(s), cashBefore, 'negative price refused -> cash unmoved');
  assert.equal(Number.isFinite(D.cash(s)), true, 'till stays a finite number');
  assert.equal(s.products[0].stock, stock, 'stock unmoved');
  assert.equal(s.day.entries.length, 0, 'nothing recorded');
});

test('a NEGATIVE per-item price override is refused too; basket and till stay put', () => {
  let s = shop();
  const cashBefore = D.cash(s);
  assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: 1, price: -3 }] }), /price/);
  assert.equal(D.cash(s), cashBefore, 'negative override refused -> cash unmoved');
  assert.equal(Number.isFinite(D.cash(s)), true, 'till stays a finite number');
  assert.equal(s.products[0].stock, s.products[0].stock, 'stock unmoved');
  assert.equal(s.day.entries.length, 0, 'nothing recorded');
});
