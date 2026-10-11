/* DATA-001 — the RESTORE DRILL (REL-001 / NFR-012 / CFG-015).
 *
 * The point of a backup is not that it uploads, or that it parses. The point
 * is that the shop comes BACK. "Upload success != recoverability": a file that
 * JSON.parse()s on the cloud can still be an unrecoverable shop.
 *
 * This drill takes a real multi-day shop, exports it exactly the way the app's
 * Export button does (JSON), then RESTORES it and reconciles every number a
 * shopkeeper would notice: the till, the day report, the month, the stock
 * ledger, and the customer count. If any of them move, the backup is not
 * recoverable and the release gate must fail.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

// A believable shop with the whole story: cash sale, credit sale (debt), a
// refund, a buy, an expense, an income, a counted drawer, and two days.
function realShop() {
  let s = D.createShop({ name: 'Drill', startCash: 100 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 20 });
  s = D.addProduct(s, { name: 'Water', buy: 0.4, sell: 0.8, stock: 30 });
  const coca = s.products[0].id, water = s.products[1].id;

  s = D.sellAll(s, { items: [{ id: coca, qty: 3 }, { id: water, qty: 2 }], paid: 7, who: 'Amine' });
  s = D.sellAll(s, { items: [{ id: coca, qty: 2 }], customer: 'Ali', who: 'Amine' }); // full credit -> debt
  s = D.refund(s, { items: [{ id: coca, qty: 1 }], reason: 'returned', saleNo: 1 });
  s = D.buyStock(s, water, 10, 0.4, 'SUP-1', 'Fournisseur');
  s = D.expense(s, { amount: 5, note: 'bags', category: 'x' });
  s = D.income(s, { amount: 20, note: 'float' });
  s = D.checkCash(s, { counted: D.cash(s) });
  s = D.closeDay(s);                                        // a closed day in history

  s = D.sellAll(s, { items: [{ id: water, qty: 4 }], paid: 4 }); // today, still open
  return s;
}

// Exactly the bytes the Settings "export backup" button writes to disk.
function exportBytes(s) { return JSON.stringify(s, null, 2); }

test('DATA-001: a real exported backup restores and EVERY total reconciles', () => {
  const live = realShop();
  const restored = D.restoreState(JSON.parse(exportBytes(live)));

  // the shop itself is intact, byte for byte
  assert.deepStrictEqual(restored, live, 'the restored shop is identical to the exported one');

  // the integrity gate agrees the restored shop is internally consistent
  assert.deepStrictEqual(D.stateProblems(restored), [], 'no integrity problems after restore');

  // 1) the till — money is derived, so it must land on the same fils
  assert.strictEqual(D.cash(restored), D.cash(live), 'till reconciles');

  // 2) tonight's report — same cash, same movements, in the same order
  const a = D.dayReport(live), b = D.dayReport(restored);
  assert.strictEqual(b.cash, a.cash, 'day-report cash reconciles');
  assert.deepStrictEqual(b.entries.map(e => e.amount), a.entries.map(e => e.amount), 'every movement reconciles');

  // 3) the month — history came back whole, not just today
  const ym = D.todayStr().slice(0, 7);
  assert.deepStrictEqual(D.monthlyReport(restored, ym), D.monthlyReport(live, ym), 'the month reconciles');

  // 4) the stock ledger — counters must equal the movement ledger
  assert.deepStrictEqual(restored.products.map(p => p.stock), live.products.map(p => p.stock), 'stock counts reconcile');

  // 5) people — the customers and the debts survived
  assert.deepStrictEqual(D.customerNames(restored), D.customerNames(live), 'customers reconcile');
  assert.deepStrictEqual(restored.debts, live.debts, 'debts reconcile');
});

test('DATA-001: a file that PARSES but is corrupt is refused — parsing is not recovering', () => {
  const live = realShop();

  // "upload success": the JSON is fine, the shop name and ids are intact...
  const tampered = JSON.parse(exportBytes(live));
  const sale = tampered.day.entries.find(e => e.kind === 'sale');
  sale.amount = 999; // ...but the money no longer matches the bill
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(tampered)), 'it still parses: an upload would report success');

  // ...and yet it is NOT recoverable: the gate refuses it.
  assert.throws(() => D.restoreState(tampered), /integrity|backup/, 'a corrupt backup is refused, not restored');

  // a half-merged backup (duplicate entry id) is caught too
  const dup = JSON.parse(exportBytes(live));
  dup.day.entries.push(JSON.parse(JSON.stringify(dup.day.entries[0])));
  assert.throws(() => D.restoreState(dup), /integrity|backup/);

  // and junk that never was a shop is refused before anything is touched
  for (const junk of [null, 42, 'hello', [], '<html>500</html>']) {
    assert.throws(() => D.restoreState(junk), /backup/);
  }
});
