/* DEKKAN CHECKOUT CONTRACT — written RED-FIRST.
 *
 * THE RULES BEING PINNED DOWN:
 *   - One checkout (sellAll) = ONE customer = ONE numbered sale entry.
 *     One number per checkout, never one per item line.
 *   - Client numbers run #1, #2, #3... within TODAY only, resetting to #1
 *     on a fresh day. Refunds and debt payments never consume a number.
 *   - The customer registry remembers every name you actually type (on any
 *     sale, exact/cash/credit/new-debt). Walk-ins (no name) record NOTHING.
 *     Names are per-Dali always OPTIONAL.
 *   - A fully-paid sale with a typed name still records the name (the
 *     receipt must show "Maher #4") but never creates a debt.
 *   - The old dictation keeps working: creditTo still means "on credit",
 *     and sell / sellFree still stand alone and feed the same counter.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shop() {
  let s = D.createShop({ name: 'Test', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10, lowAt: 3 });
  s = D.addProduct(s, { name: 'Pain', buy: 0.4, sell: 1, stock: 10, lowAt: 2 });
  return s;
}
const salesOf = (s) => s.day.entries.filter(function (e) { return e.kind === 'sale'; });

test('a fresh shop: registry empty, day starts at #1', () => {
  const s = shop();
  assert.deepStrictEqual(D.customerNames(s), [], 'no customers yet');
  assert.strictEqual(D.nextClientNo(s), 1, 'the first client of the day is #1');
  assert.strictEqual(D.dayReport(s).entries.length, 0, 'no moves yet');
});

test('a checkout is ONE numbered sale — mixed baskets are not split', () => {
  let s = shop();
  // 2 colas (3.00) + 1 cafe (2.00) = one 5.00 bill, one customer
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], free: [{ name: 'Cafe', price: 2, qty: 1 }] });
  assert.strictEqual(salesOf(s).length, 1, '5.00 bill = one entry, not two');
  assert.strictEqual(D.cash(s), 55, 'cash = 50 + 5');
  assert.strictEqual(s.products[0].stock, 8, '2 colas left the shelf');
  assert.strictEqual(D.nextClientNo(s), 2, 'the next customer is #2');
});

test('client numbers run 1..N in order and ride on the report', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }] });                       // #1 walk-in
  s = D.sellAll(s, { items: [{ id: s.products[1].id, qty: 1 }], customer: 'Ahmed' });    // #2
  s = D.sellAll(s, { free: [{ name: 'Cafe', price: 2, qty: 1 }] });                      // #3 walk-in
  const entries = D.dayReport(s).entries;
  assert.deepStrictEqual(entries.filter(function (e) { return e.kind === 'sale'; }).map(function (e) { return e.no; }),
    [1, 2, 3], 'the ledger knows every sale number');
  const ahmed = entries.find(function (e) { return e.kind === 'sale' && e.note === 'Ahmed'; });
  assert.strictEqual(ahmed.no, 2, "entry #2 is Ahmed's");
  assert.strictEqual(D.clientNoOf(s, ahmed.id), 2, 'clientNoOf agrees with the ledger');
});

test('refunds and debt payments never consume client numbers', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 1, customer: 'Samir' }); // #1, 2.00 rest
  s = D.refund(s, { items: [{ id: s.products[0].id, qty: 1 }] });                             // a refund
  const samir = s.debts.find(function (d) { return d.name === 'Samir'; });
  s = D.payDebt(s, samir.id, { amount: 2 });                                                  // a debt payment
  assert.strictEqual(D.nextClientNo(s), 2, 'still #2 — refunds/payments are not customers');
  s = D.sellAll(s, { free: [{ name: 'Cafe', price: 1, qty: 1 }] });                           // #2
  const cafe = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(D.clientNoOf(s, cafe.id), 2, 'the cafe client IS #2');
  assert.strictEqual(D.nextClientNo(s), 3, 'and the counter moved on');
});

test('tomorrow, the counter starts at #1 again', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }] });   // #1
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }] });   // #2
  s = D.closeDay(s);
  assert.strictEqual(D.nextClientNo(s), 1, 'a fresh open day starts at one');
  s.day.date = '2001-01-01';                                          // stale papers from another day
  assert.strictEqual(D.nextClientNo(s), 1, 'yesterday\'s counter never leaks into today');
});

test('typed names go to the registry once; walk-ins add nothing', () => {
  let s = shop();
  s = D.sellAll(s, { free: [{ name: 'Cafe', price: 1, qty: 1 }] });   // walk-in, no name
  assert.deepStrictEqual(D.customerNames(s), [], 'no name typed -> nothing remembered');
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }], customer: 'Adam' });  // exact cash + name
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }], customer: 'adam' });  // same person, typing style
  s = D.sellAll(s, { free: [{ name: 'Cafe', price: 1, qty: 1 }], customer: 'Zied' });
  assert.deepStrictEqual(D.customerNames(s), ['Zied', 'Adam'], 'unique names, most recent first');
  assert.strictEqual(s.customers.length, 2, 'the registry itself holds exactly 2');
});

test('a fully paid sale still records the typed name — no debt is invented', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 3, customer: 'Maher' }); // exact 3.00
  assert.strictEqual(D.cash(s), 53, 'the box took the 3.00');
  assert.strictEqual(s.debts.length, 0, 'exact money creates no debt');
  assert.deepStrictEqual(D.customerNames(s), ['Maher'], 'the name is remembered for next time');
  const e = salesOf(s)[0];
  assert.strictEqual(e.amount, 3, 'cash in recorded');
  assert.strictEqual(e.note, 'Maher', 'the sale entry knows who bought');
  assert.strictEqual(D.clientNoOf(s, e.id), 1, 'client #1 of the day');
});

test('overpay with a name: change out, no debt, name remembered', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }], paid: 5, customer: 'Amine' });
  assert.strictEqual(D.cash(s), 51.5, 'only the price enters the box');
  assert.strictEqual(s.debts.length, 0, 'the extra is change, never a debt');
  assert.deepStrictEqual(D.customerNames(s), ['Amine'], 'name remembered');
});

test('partial payment: the rest is a debt on the named customer; unnamed partial is refused', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 1, customer: 'Samir' }); // 3.00 bill
  assert.strictEqual(D.cash(s), 51, 'only the 1.00 handed over enters the box');
  assert.strictEqual(s.debts.length, 1, 'one debt opened');
  assert.strictEqual(s.debts[0].name, 'Samir');
  assert.strictEqual(s.debts[0].total, 2, 'the 2.00 rest sits on Samir');

  const before = JSON.stringify(s);
  assert.throws(function () { D.sellAll(s, { items: [{ id: s.products[1].id, qty: 2 }], paid: 1 }); }, /customer/);
  assert.strictEqual(JSON.stringify(s), before, 'the refusal changed NOTHING (stock, cash, registry)');
});

test('full credit: cash does not move, the whole net is on the customer', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], customer: 'Riadh' });
  assert.strictEqual(D.cash(s), 50, 'no cash moved');
  assert.strictEqual(s.debts.length, 1);
  assert.strictEqual(s.debts[0].name, 'Riadh');
  assert.strictEqual(s.debts[0].total, 3, 'all 3.00 on Riadh');
  const e = salesOf(s)[0];
  assert.strictEqual(e.amount, 0, 'the entry records zero cash in');
  assert.strictEqual(e.note, 'Riadh', 'and who owns the bill');
});

test('creditTo still means "on credit" — the old dictation keeps working', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }], creditTo: 'Old Way' });
  assert.strictEqual(s.debts[0].name, 'Old Way', 'full credit via creditTo');
  assert.deepStrictEqual(D.customerNames(s), ['Old Way'], 'creditTo names feed the registry too');
});

test('sell / sellFree still stand alone and feed the same counter', () => {
  let s = shop();
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 1 }] });
  s = D.sellFree(s, { name: 'Cafe', price: 2, qty: 1 });
  assert.strictEqual(salesOf(s).length, 2, 'two ops = two entries = two numbers');
  assert.strictEqual(D.nextClientNo(s), 3, 'the counter counts them both');
});

test('sellAll discount cuts the WHOLE bill — stock and free together', () => {
  let s = shop();
  // 2 colas (3.00) + 1 cafe (2.00) = 5.00; 10% -> 4.50
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], free: [{ name: 'Cafe', price: 2, qty: 1 }], discount: { percent: 10 } });
  assert.strictEqual(D.cash(s), 54.5, '10% off the whole 5.00 bill');
  s = D.sellAll(s, { free: [{ name: 'Cafe', price: 2, qty: 1 }], discount: { amount: 0.5 } });
  assert.strictEqual(D.cash(s), 56, 'flat discount works on free-only too');
});

test('sellAll validation is strict — a bad call changes NOTHING', () => {
  let s = shop();
  const before = JSON.stringify(s);
  assert.throws(function () { D.sellAll(s, {}); }, /nothing to sell/);
  assert.throws(function () { D.sellAll(s, { items: [{ id: s.products[0].id, qty: 0 }] }); }, /qty/);
  assert.throws(function () { D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1e15 }] }); }, /stock/);
  assert.throws(function () { D.sellAll(s, { items: [{ id: 'nope', qty: 1 }] }); }, /product/);
  assert.throws(function () { D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1, price: -1 }] }); }, /price/);
  assert.throws(function () { D.sellAll(s, { free: [{ price: 2, qty: 1 }] }); }, /name/);
  assert.throws(function () { D.sellAll(s, { free: [{ name: 'C', price: -2, qty: 1 }] }); }, /price/);
  assert.strictEqual(JSON.stringify(s), before, 'every refusal left the shop byte-identical');
});

test('non-sale moves have no client number in the report', () => {
  let s = shop();
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }] });
  s = D.expense(s, { amount: 2, note: 'rent' });
  s = D.checkCash(s, { counted: D.cash(s) });
  const entries = D.dayReport(s).entries;
  assert.strictEqual(entries[0].no, 1, 'the sale is #1');
  assert.strictEqual(entries[1].no, null, 'an expense has no client number');
  assert.strictEqual(entries[2].no, null, 'a cash check has no client number');
});

test('the notebook feeds the registry, and sellAll can carry a phone', () => {
  let s = shop();
  s = D.addDebt(s, { name: 'Salma', amount: 5 });
  assert.deepStrictEqual(D.customerNames(s), ['Salma'], 'the notebook feeds the counter\'s memory');
  s = D.sellAll(s, { free: [{ name: 'Cafe', price: 1, qty: 1 }], customer: 'Salma', phone: '29000000' });
  assert.strictEqual(s.customers.length, 1, 'no duplicate customer');
  assert.strictEqual(s.customers[0].phone, '29000000', 'the phone was captured');
});