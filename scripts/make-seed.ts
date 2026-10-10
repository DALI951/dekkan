/* Builds seed-demo.json for dekkan by driving the REAL core (core/dekkan-core.js)
 * so every field (bills, who, cashier registry, soldByProduct, checks, rollovers)
 * is byte-identical to what the app itself would produce. Then rewrites the
 * timestamps into a 5-day story (4 closed days + today) so EVERY tab has data:
 * report (all entry kinds), past-day picker, monthly review (2 months), clients,
 * debts (open + settled), cashbox categories, employees, cashiers, low stock.
 *
 * Usage: node scripts/make-seed.cjs
 * Output: seed-demo.json (repo root)
 *
 * NOTE: keep this file UTF-8. Never round-trip it through PowerShell
 * Get-Content/Set-Content (ANSI default re-encodes and mojibakes Arabic).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../core/dekkan-core.js');

let s = D.createShop({ name: 'Café Ben Arous', startCash: 150 });
s = D.updateShop(s, { name: 'Café Ben Arous — Demo' });

// ---------- products: normal / low-stock / sold-out / big stock / no low line ----------
const prods = [
  ['قهوة', 0.6, 1.5, 40, 10],
  ['شاي', 0.4, 1.0, 30, 10],
  ['كوكا', 0.9, 1.8, 12, 5],
  ['ميرندا', 0.9, 1.8, 2, 5],          // LOW -> red banner + restock list
  ['ماء', 0.4, 0.8, 24, 6],
  ['شيبس', 0.7, 1.5, 0, 5],            // SOLD OUT
  ['كرواسون', 0.5, 1.2, 18, 8],
  ['ساندويتش تونة', 1.2, 3.0, 8, 4],
  ['حليب', 0.8, 1.5, 15, 6],
  ['سجائر', 3.5, 4.5, 20, 10]
];
for (const [name, buy, sell, stock, lowAt] of prods) {
  s = D.addProduct(s, { name, buy, sell, stock, lowAt });
}
const P = {}; s.products.forEach(p => { P[p.name] = p.id; });

// ---------- cashbox categories ----------
s = D.addCategory(s, { name: 'أموال خاصة', side: 'in' });
s = D.addCategory(s, { name: 'استرجاع لمستهلك', side: 'in' });
s = D.addCategory(s, { name: 'فواتير', side: 'out' });
s = D.addCategory(s, { name: 'مشتريات محل', side: 'out' });

// ---------- employees ----------
const e1 = D.addEmployee(s, { name: 'أحمد المرزوقي', type: 'كاشير', salary: 400, phone: '+216 22 111 111', note: 'دوام صباحي' });
s = e1;
const e2 = D.addEmployee(s, { name: 'ليلى بن صالح', type: 'كاشير', salary: 450, phone: '+216 98 222 222', note: 'دوام مسائي' });
s = e2;
const e3 = D.addEmployee(s, { name: 'محمد العباسي', type: 'مشرف', salary: 600, phone: null, note: '' });
s = D.fireEmployee(e3, e3.employees.find(e => e.name === 'محمد العباسي').id); // fired -> monthly shows his salary

// =====================================================================
// DAY 1 — 2026-08-14 (previous month): opens, sells, refund, expense, check
// =====================================================================
s = D.sellAll(s, { items: [{ id: P['قهوة'], qty: 12 }, { id: P['كوكا'], qty: 4 }], paid: 30, who: 'أحمد' });
s = D.sellAll(s, { items: [{ id: P['شاي'], qty: 5 }], paid: 5, who: 'ليلى' });
// a full-credit sale -> adds a debt to Salma, no cash in
s = D.sellAll(s, { items: [{ id: P['ساندويتش تونة'], qty: 2 }], customer: 'سلمى', who: 'أحمد' });
// refund one coffee — the last sale entry number is nextClientNo - 1
s = D.refund(s, { items: [{ id: P['قهوة'], qty: 1 }], reason: 'زبون رجعها', saleNo: D.nextClientNo(s) - 1 });
// expense: electricity
s = D.expense(s, { amount: 20, note: 'فاتورة كهرباء الشهر', category: 'فواتير' });
// income: owner pocket money
s = D.income(s, { amount: 50, note: 'فلوس من جيب المالك', category: 'أموال خاصة' });
// buy stock (cash out)
s = D.buyStock(s, P['كوكا'], 10, 0.9);
s = D.buyStock(s, P['شيبس'], 3, 0.7);   // chips stocked day 1, sold out again day 2
// morning-count check: drawer has the exact sum
s = D.checkCash(s, { counted: D.cash(s) });
s = D.closeDay(s); // -> closed, day 1 done

// =====================================================================
// DAY 2 — 2026-08-28: sales, partial debt pay, another check
// =====================================================================
s = D.sellAll(s, { items: [{ id: P['قهوة'], qty: 8 }, { id: P['ماء'], qty: 3 }], paid: 15, who: 'أحمد' });
s = D.sellAll(s, { items: [{ id: P['شيبس'], qty: 3 }], paid: 4.5, who: 'ليلى' }); // -> 0 again (sold-out for today)
// Salma pays half her 6 TND debt
const salmaDebt = D.getDebtByName(s, 'سلمى');
s = D.payDebt(s, salmaDebt.id, { amount: 3 });
// flat-discount sale
s = D.sellAll(s, { items: [{ id: P['كرواسون'], qty: 4 }], discount: { amount: 1 }, paid: 3.8, who: 'أحمد' });
s = D.closeDay(s);

// =====================================================================
// DAY 3 — 2026-09-07: free-item sale + expense + check (with 0.5 mismatch)
// =====================================================================
s = D.sellFree(s, { name: 'قهوة للضيف', qty: 1, price: 0, who: 'أحمد' });
s = D.sellAll(s, { items: [{ id: P['شاي'], qty: 6 }, { id: P['حليب'], qty: 2 }], paid: 9, who: 'ليلى' });
s = D.checkCash(s, { counted: D.cash(s) + 0.5 }); // 0.5 difference -> red diff in report
s = D.expense(s, { amount: 15, note: 'منظفات', category: 'مشتريات محل' });
s = D.closeDay(s);

// =====================================================================
// DAY 4 — 2026-09-18: the week before today
// =====================================================================
s = D.sellAll(s, { items: [{ id: P['قهوة'], qty: 10 }], paid: 15, who: 'أحمد' });
s = D.sellAll(s, { items: [{ id: P['كوكا'], qty: 2 }, { id: P['سجائر'], qty: 1 }], paid: 8.1, who: 'ليلى' });
// second debtor: full credit to Farid
s = D.sellAll(s, { items: [{ id: P['ساندويتش تونة'], qty: 1 }], customer: 'فريد', who: 'أحمد' });
s = D.closeDay(s);

// =====================================================================
// TODAY — 2026-09-21 (OPEN): morning cash = last day's endCash
// =====================================================================
s = D.sellAll(s, { items: [{ id: P['قهوة'], qty: 6 }], paid: 9, who: 'أحمد' });
s = D.sellAll(s, { items: [{ id: P['شاي'], qty: 4 }], paid: 4, who: 'ليلى' });
const faridDebt = D.getDebtByName(s, 'فريد');
if (faridDebt) s = D.payDebt(s, faridDebt.id, { amount: 3 });

// ---------- THE STORY DATES (rewrite timestamps) ----------
const daysMap = [
  { idx: 0, date: '2026-08-14' },
  { idx: 1, date: '2026-08-28' },
  { idx: 2, date: '2026-09-07' },
  { idx: 3, date: '2026-09-18' }
];
const closed = s.days.slice();
closed.forEach((d, i) => {
  const info = daysMap[i];
  d.date = info.date;
  d.openedAt = info.date + 'T07:' + String(10 + i).padStart(2, '0') + ':00.000Z';
  d.closedAt = info.date + 'T20:30:00.000Z';
  let t = 8 * 60;
  d.entries.forEach(e => {
    const h = Math.floor(t / 60), m = t % 60;
    e.at = info.date + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00.000Z';
    t += 40 + Math.floor(Math.random() * 45);
    if (t > 20 * 60) t = 8 * 60;
  });
  d.checks.forEach(c => {
    const h = Math.floor(t / 60), m = t % 60;
    c.at = info.date + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00.000Z';
    t += 60;
  });
});
// the open day stays real-today with morning-ish times
const today = D.todayStr();
s.day.date = today;
s.day.openedAt = today + 'T07:30:00.000Z';
let tt = 8 * 60;
s.day.entries.forEach(e => {
  const h = Math.floor(tt / 60), m = tt % 60;
  e.at = today + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00.000Z';
  tt += 50;
});

// ---------- write + verify ----------
const out = path.join(__dirname, '..', 'seed-demo.json');
fs.writeFileSync(out, JSON.stringify(s, null, 2), 'utf8');

const r = D.restoreState(JSON.parse(JSON.stringify(s)));
console.log('WROTE', out);
console.log('cash            :', D.cash(r));
console.log('closed days     :', r.days.length);
console.log('monthly 08 days :', D.monthlyReport(r, '2026-08').days.length);
console.log('monthly 09 days :', D.monthlyReport(r, '2026-09').days.length);
console.log('past-day 09-07  :', !!D.dayReportFor(r, '2026-09-07'));
console.log('clients         :', D.clientsReport(r).clients.map(c => c.name + ':' + c.owed).join(', '));
console.log('cashiers        :', D.cashierNames(r).join(', '));
console.log('low stock       :', D.restockNeed(r).map(x => x.name).join(', '));
console.log('open debts      :', r.debts.filter(d => d.total > d.paid).map(d => d.name).join(', '));
// mojibake self-check: double-encoded Arabic produces 'Ø'/'Ã' garbage
const raw = fs.readFileSync(out, 'utf8');
console.log('mojibake check  :', /Ã|Ø|Ù|Ø£/.test(raw) ? 'FAIL — bad bytes present!' : 'clean (no double-encoded bytes)');