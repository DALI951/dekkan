// DEKKAN STORY SIMULATOR — one realistic shop day, MANY aspects tested at once.
// This is the "run multiple tests on multiple aspects" battery: it plays a full
// Tunisian café story (sales, stock, credit, refunds, discounts, expenses,
// cash checks, day close) and asserts every rule holds along the way.
//
// Read the story below — it mirrors exactly how a real café runs.
// Run: npm run test:sim    (exit code 0 = whole story is honest, 1 = something broke)
//
// Print format: every aspect gets its own PASS line, so you SEE what got checked.

'use strict';
const D = require('../core/dekkan-core.js');

let passes = 0, fails = 0;

function ok(condition, label, detail) {
  if (condition) {
    passes++;
    console.log('  PASS  ' + label + (detail ? '  (' + detail + ')' : ''));
  } else {
    fails++;
    console.log('  FAIL  ' + label + (detail ? '  (' + detail + ')' : '') + '  <-- NOTS OK');
  }
}

function near(a, b) {
  return Math.abs(a - b) < 0.001;
}

// fresh money to compare against
const M = (n) => Math.round(n * 1000) / 1000;

// ============ THE STORY ============
console.log('\n=== DEKKAN DAY SIMULATION — Cafe Ben Arous ===\n');

// --- morning ---
let s = D.createShop({ name: 'Cafe Ben Arous', startCash: 80 });
s = D.addProduct(s, { name: 'Coca 33cl', buy: 0.8, sell: 1.5, stock: 30, lowAt: 5 });
s = D.addProduct(s, { name: 'Pain', buy: 0.4, sell: 1, stock: 50, lowAt: 10 });
s = D.addProduct(s, { name: 'Couscous', buy: 3, sell: 6, stock: 5, lowAt: 2 });
s = D.addProduct(s, { name: 'Kitkat', buy: 0.9, sell: 2, stock: 10, lowAt: 3 });

console.log('-- morning: shop opened with 80 TND, 4 products on the shelf');

// --- restock the couscous for lunch service ---
s = D.buyStock(s, s.products[2].id, 10, 3);
ok(D.getProduct(s, s.products[2].id).stock === 15, 'restock: couscous 5 -> 15');
ok(D.cash(s) === 80 - 30, 'restock cost that cash (80 -> 50)');

// --- normal cash sales ---
s = D.sell(s, { items: [{ id: s.products[0].id, qty: 5 }, { id: s.products[1].id, qty: 3 }] });
let cashLine = 50 + 5 * 1.5 + 3 * 1;
s = D.sell(s, { items: [{ id: s.products[2].id, qty: 1 }, { id: s.products[3].id, qty: 2 }] });
cashLine += 1 * 6 + 2 * 2;
ok(D.cash(s) === cashLine, 'cash box follows every sale', cashLine + ' TND');
ok(D.getProduct(s, s.products[0].id).stock === 25, 'cola stock: 30 -> 25 after 5 sold');

console.log('-- midday: regular customers paid cash');

// --- discount: 10% percent on a table of colas ---
s = D.sell(s, { items: [{ id: s.products[0].id, qty: 4 }], discount: { percent: 10 } }); // 6 -> 5.4
cashLine += 5.4;
ok(D.cash(s) === cashLine, 'percent discount: 4 colas 6.00 -> 5.40 (you eat the margin)');
ok(D.stats(s).costOfSold === M(5 * 0.8 + 3 * 0.4 + 1 * 3 + 2 * 0.9 + 4 * 0.8),
  'cost of the day so far is exact (5 colas + 3 pains + 1 couscous + 2 kitkats + 4 colas)');

// --- flat discount: fixed deal button ---
s = D.sell(s, { items: [{ id: s.products[1].id, qty: 2 }], discount: { amount: 0.5 } }); // 2 -> 1.5
cashLine += 1.5;
ok(D.cash(s) === cashLine, 'flat discount: 2 pains 2.00 -> 1.50');

console.log('-- discounts: 10% table deal + 0.50 pain deal, both tolerated');

// --- credit: Ahmed takes lunch on the notebook ---
s = D.sell(s, { items: [{ id: s.products[2].id, qty: 2 }, { id: s.products[0].id, qty: 2 }], creditTo: 'Ahmed' }); // 12+3=15 debt
ok(D.cash(s) === cashLine, 'credit sale: cash does NOT move');
ok(D.debtsOwed(s) === 15, 'Ahmed owes 15 on the notebook');
ok(D.getProduct(s, s.products[2].id).stock === 12, 'couscous stock went down anyway (15 - 1 - 2 = 12)');

// Rami grabs a Kitkat on credit too — separate debt
s = D.sell(s, { items: [{ id: s.products[3].id, qty: 1 }], creditTo: 'Rami' });
ok(D.debtsOwed(s) === 17, 'second customer, separate notebook entry (Ahmed 15 + Rami 2)');

// Ahmed pays 10 of the 15
s = D.payDebt(s, s.debts[0].id, { amount: 10 });
cashLine += 10;
ok(D.cash(s) === cashLine, 'Ahmed pays 10: cash in, debt down');
ok(D.debtsOwed(s) === 7, 'notebook now says 7 (Ahmed 5 left + Rami 2)');
ok(s.debts[0].settled === false, 'Ahmed still has an open debt (5 left)');

console.log('-- notebook: 2 customers on credit, Ahmed paid most of his');

// --- PARTIAL PAYMENT at the counter: Samir hands over 1.00 on a 3.00 bill ---
s = D.sell(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 1, creditTo: 'Samir' }); // 2 colas = 3.00
cashLine += 1;
ok(D.cash(s) === cashLine, 'partial pay: only the 1.00 handed over enters the box');
ok(D.debtsOwed(s) === 9, 'partial pay: the 2.00 rest sits on Samir (7 + 2)');
ok(s.day.entries.filter(function (e) { return e.kind === 'sale' && e.amount === 1; }).length === 1,
  'partial pay: the ledger shows the 1.00, not the 3.00');

// another customer overpays: the box keeps the price, the extra is change to hand back
let cashBefore = D.cash(s);
s = D.sell(s, { items: [{ id: s.products[1].id, qty: 2 }], paid: 5 }); // 2 pains = 2.00
cashLine += 2;
ok(D.cash(s) === cashLine, 'overpay: the box takes 2.00, the 3.00 extra is change (never cash-in)');
ok(D.debtsOwed(s) === 9, 'overpay: paying too much never creates a debt');
ok(D.cash(s) === cashBefore + 2, 'overpay: cash rose by the price only');

// Samir settles the 2.00 rest the next trip
const samir = s.debts.filter(function (d) { return d.name === 'Samir'; })[0];
s = D.payDebt(s, samir.id, { amount: 2 });
cashLine += 2;
ok(D.cash(s) === cashLine, 'Samir pays the rest: cash in');
ok(D.debtsOwed(s) === 7, 'notebook back to 7 (Rami 2 + Ahmed 5)');

console.log('-- till: a part-paid sale, an overpaid sale with change, and the rest paid later');

// --- refunds: bad bottle ---
s = D.refund(s, { items: [{ id: s.products[0].id, qty: 1 }], reason: 'bad bottle' }); // -1.5
cashLine -= 1.5;
ok(D.cash(s) === cashLine, 'refund: 1.50 back to the customer');
// 30 - 5 (first sell) - 4 (discount table) - 2 (Ahmed credit) - 2 (Samir part-pay) + 1 (refund) = 18
ok(D.getProduct(s, s.products[0].id).stock === 18, 'cola shelf re-checked after refund (30-5-4-2-2+1=18)');

// credit refund: Ahmed returns one of his couscous — his debt shrinks
s = D.refund(s, { items: [{ id: s.products[2].id, qty: 1 }], creditTo: 'Ahmed' });
ok(D.cash(s) === cashLine, 'credit refund: NO cash moves');
// Ahmed: owed 15, paid 10 -> 5 left; refund 6 clamps to remaining 5 -> settled.
// The notebook now only shows Rami's 2.
ok(D.debtsOwed(s) === 2, 'notebook final: only Rami 2 remains (Ahmed settled)');

console.log('-- refunds: bad cola cash refund + Ahmed returned a couscous on credit');

// --- shop expenses + pocket money ---
s = D.expense(s, { amount: 25, note: 'electricity' });
cashLine -= 25;
s = D.income(s, { amount: 50, note: 'from home' });
cashLine += 50;
ok(D.cash(s) === cashLine, 'expense (25) + pocket money (50): cash follows');

// --- the drawer check: shopkeeper counts 2 TND short ---
s = D.checkCash(s, { counted: cashLine - 2 });
const check = D.stats(s).lastCheck;
ok(check.expected === cashLine && check.counted === cashLine - 2 && check.diff === -2 && check.ok === false,
  'cash check: expected ' + cashLine + ', counted ' + (cashLine - 2) + ', diff -2 -> flagged');
ok(D.cash(s) === cashLine, 'the check itself moved zero money');

console.log('-- closing: counted the drawer -> 2 TND short, flagged for the owner');

// --- the daily report must tell the whole story ---
const r = D.dayReport(s);
ok(r.startCash === 80, 'report: day started with 80');
ok(r.cash === cashLine, 'report: cash now matches the running story');
const entryCount = r.entries.length;
ok(entryCount === 16, 'report: all ' + entryCount + ' money moves are listed');
ok(r.totals.refunds === 1.5, 'report: refunds total 1.50');
ok(near(r.dayProfit, r.netSales - r.costOfSold - r.dayBuys - r.dayExpenses), 'report: profit = money in - money out');
ok(r.debts.total === 2, 'report: open debts = 2 TND');

console.log('-- daily report: every move traced from open to close');

// --- close the day, live another one ---
let endCash = D.cash(s);
s = D.closeDay(s);
ok(s.days.length === 1, 'day closed into history');
ok(s.days[0].endCash === endCash, 'history froze the closing cash');
ok(s.day.startCash === endCash, 'new day opened with exactly the closing cash');
s = D.sell(s, { items: [{ id: s.products[1].id, qty: 1 }] });
ok(D.cash(s) === endCash + 1, 'day 2: first sale lands in the new day');
ok(D.dayReport(s).entries.length === 1, 'day 2 report only shows today moves (yesterday is frozen)');

console.log('-- day rollover: closed day frozen, new day rolls on');

// --- CLIENT NUMBERS + THE COUNTER'S MEMORY ---
// Every customer of the day gets a # (walk-ins too), the queue empties
// at midnight, and the registry only ever remembers names that were typed.
console.log('\n-- client numbers: one # per customer — walk-ins and named alike');

let c3 = D.cash(s);
s = D.closeDay(s);   // day 2 done -> day 3 opens with an empty queue
ok(D.nextClientNo(s) === 1, 'new day opens — the queue starts at #1 again');

// #1: a walk-in buys 2 pains, cash, no name
const namesBefore = D.customerNames(s).length;   // Samir, Ahmed, Rami from the notebook story
s = D.sellAll(s, { items: [{ id: s.products[1].id, qty: 2 }] });   // 2.00
c3 += 2;
ok(D.cash(s) === c3, 'walk-in #1 pays cash (2.00 in)');
ok(D.customerNames(s).length === namesBefore, 'no name typed -> the walk-in adds NOBODY to the memory');
ok(s.day.entries.filter(function (e) { return e.kind === 'sale'; })[0].note === null,
  'the receipt has no name to print — just the #');

// #2: Mahmoud pays exact cash WITH a name — remembered, no debt
const debtsBefore = s.debts.length;   // only Rami's old 2.00 is open
s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 3, customer: 'Mahmoud' });
c3 += 3;
ok(D.cash(s) === c3, 'exact 3.00 in, nothing on the notebook');
ok(D.customerNames(s)[0] === 'Mahmoud', 'Mahmoud joins the counter\'s memory');
ok(s.debts.length === debtsBefore, 'exact money adds no debt — Rami\'s old one is untouched');

// #3: a MIXED basket (cola + cafe) is ONE numbered client
s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }], free: [{ name: 'Cafe', price: 2, qty: 1 }] });
c3 += 3.5;
ok(D.cash(s) === c3, 'mixed bill: 3.50 in one payment');
ok(D.nextClientNo(s) === 4, 'a stock+free basket is ONE client, not two');
const day3 = D.dayReport(s).entries.filter(function (e) { return e.kind === 'sale'; });
ok(day3.length === 3, 'day 3 so far: exactly 3 numbered sales');
ok(day3[0].no === 1 && day3[1].no === 2 && day3[2].no === 3, 'the ledger numbers them #1 #2 #3 in order');

// #4: Riadh takes a cola on credit — numbered too
s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }], customer: 'Riadh' });
ok(D.nextClientNo(s) === 5, 'credit customers are customers too');
ok(D.customerNames(s)[0] === 'Riadh', 'Riadh jumps to the top of the counter\'s memory');

// a refund is NOT a customer
s = D.refund(s, { items: [{ id: s.products[1].id, qty: 1 }] });
c3 -= 1;
ok(D.cash(s) === c3, 'the refund moved cash back (open to close honesty holds)');
ok(D.nextClientNo(s) === 5, 'a refund does not take a number — the queue waits');
ok(D.customerNames(s).length === namesBefore + 2, 'memory grew by exactly the two NAMED customers (Mahmoud, Riadh)');

console.log('-- the counter remembers only named customers, and never runs out of #s');

// --- the brain also loads in a BROWSER (window.Dekkan), not just node ---
// (the core is now a loader + module files; the page loads them in this order)
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const sandbox = { window: {} };
vm.createContext(sandbox);
sandbox.window = sandbox;
sandbox.self = sandbox;
['dekkan-core.js', 'core.js', 'products.js', 'debts.js', 'sales.js', 'refunds.js',
  'employees.js', 'cashbox.js', 'report.js', 'shop.js', 'pin.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'core', f), 'utf8'), sandbox);
});
ok(typeof sandbox.window.Dekkan === 'object' && typeof sandbox.window.Dekkan.createShop === 'function',
  'browser load: the same files expose window.Dekkan (the webapp can use it)');
const b = sandbox.window.Dekkan.createShop({ startCash: 5 });
ok(sandbox.window.Dekkan.cash(b) === 5, 'browser brain works (cash = 5 on a fresh shop)');

// --- the MONTHLY report: the whole story adds up inside its month ---
console.log('\n-- monthly review: the whole story lives in this month');
const now = D.todayStr().slice(0, 7);
const allMoves = s.days.reduce(function (a, d) { return a.concat(d.entries); }, []).concat(s.day.entries)
  .filter(function (e) { return e.kind !== 'check'; });
const rm = D.monthlyReport(s, now);
ok(rm.moves === allMoves.length, 'monthly: every money move of the story is in the month');
ok(rm.sales === D.money(allMoves.reduce(function (a, e) { return a + (e.kind === 'sale' ? e.amount : 0); }, 0)),
  'monthly: the sales column matches the ledger');
ok(rm.profit === D.money(rm.wins - rm.losses), 'monthly: profit = wins - losses');
ok(rm.salaries === 0, 'monthly: no team hired -> no salaries');
s = D.addEmployee(s, { name: 'Sami', type: 'chef', salary: 300 });
ok(D.salariesFor(s, now) === 300, 'monthly: a hire adds their salary to the month');
ok(D.monthlyReport(s, now).losses === D.money(rm.losses + 300), 'monthly: the salary lands inside the losses');
ok(D.monthlyReport(s, '2000-01').moves === 0 && D.monthlyReport(s, '2000-01').profit === 0,
  'monthly: a month before the shop existed is empty');

// ============ VERDICT ============
console.log('\n=== simulation done: ' + passes + ' passed, ' + fails + ' failed ===\n');
if (fails > 0 || passes === 0) {
  console.error('SIMULATION FAILED');
  process.exit(1);
}
console.log('SIMULATION OK — the whole day was honest from open to close.');