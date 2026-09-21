/* Builds seed-demo.json for dekkan by driving the REAL core (core/dekkan-core.js)
 * so every field (bills, who, cashier registry, soldByProduct, checks, rollovers)
 * is byte-identical to what the app itself would produce. Then rewrites the
 * timestamps into a 5-day story (4 closed days + today) so EVERY tab has data:
 * report (all entry kinds), past-day picker, monthly review (2 months), clients,
 * debts (open + settled), cashbox categories, employees, cashiers, low stock.
 *
 * Usage: node Temp/opencode/make-seed.cjs
 * Output: C:\Users\Dali\Projects\dekkan\seed-demo.json
 */
'use strict';
const fs = require('fs');
const D = require('C:/Users/Dali/Projects/dekkan/core/dekkan-core.js');

let s = D.createShop({ name: 'CafÃ© Ben Arous', startCash: 150 });
s = D.updateShop(s, { name: 'CafÃ© Ben Arous â€” Demo' });

// ---------- products: normal / low-stock / sold-out / big stock / no low line ----------
const prods = [
  ['Ù‚Ù‡ÙˆØ©', 0.6, 1.5, 40, 10],
  ['Ø´Ø§ÙŠ', 0.4, 1.0, 30, 10],
  ['ÙƒÙˆÙƒØ§', 0.9, 1.8, 12, 5],
  ['Ù…ÙŠØ±Ù†Ø¯Ø§', 0.9, 1.8, 2, 5],          // LOW -> red banner + restock list
  ['Ù…Ø§Ø¡', 0.4, 0.8, 24, 6],
  ['Ø´ÙŠØ¨Ø³', 0.7, 1.5, 0, 5],            // SOLD OUT
  ['ÙƒØ±ÙˆØ§Ø³ÙˆÙ†', 0.5, 1.2, 18, 8],
  ['Ø³Ø§Ù†Ø¯ÙˆÙŠØªØ´ ØªÙˆÙ†Ø©', 1.2, 3.0, 8, 4],
  ['Ø­Ù„ÙŠØ¨', 0.8, 1.5, 15, 6],
  ['Ø³Ø¬Ø§Ø¦Ø±', 3.5, 4.5, 20, 10]          // fixed-price, no per-lot buy trick
];
for (const [name, buy, sell, stock, lowAt] of prods) {
  s = D.addProduct(s, { name, buy, sell, stock, lowAt });
}
const P = {}; s.products.forEach(p => { P[p.name] = p.id; });

// ---------- cashbox categories ----------
s = D.addCategory(s, { name: 'Ø£Ù…ÙˆØ§Ù„ Ø®Ø§ØµØ©', side: 'in' });
s = D.addCategory(s, { name: 'Ø§Ø³ØªØ±Ø¬Ø§Ø¹ Ù„Ù…Ø³ØªÙ‡Ù„Ùƒ', side: 'in' });
s = D.addCategory(s, { name: 'ÙÙˆØ§ØªÙŠØ±', side: 'out' });
s = D.addCategory(s, { name: 'Ù…Ø´ØªØ±ÙŠØ§Øª Ù…Ø­Ù„', side: 'out' });

// ---------- employees ----------
let e1 = D.addEmployee(s, { name: 'Ø£Ø­Ù…Ø¯ Ø§Ù„Ù…Ø±Ø²ÙˆÙ‚ÙŠ', type: 'ÙƒØ§Ø´ÙŠØ±', salary: 400, phone: '+216 22 111 111', note: 'Ø¯ÙˆØ§Ù… ØµØ¨Ø§Ø­ÙŠ' });
s = e1;
let e2 = D.addEmployee(s, { name: 'Ù„ÙŠÙ„Ù‰ Ø¨Ù† ØµØ§Ù„Ø­', type: 'ÙƒØ§Ø´ÙŠØ±', salary: 450, phone: '+216 98 222 222', note: 'Ø¯ÙˆØ§Ù… Ù…Ø³Ø§Ø¦ÙŠ' });
s = e2;
let e3 = D.addEmployee(s, { name: 'Ù…Ø­Ù…Ø¯ Ø§Ù„Ø¹Ø¨Ø§Ø³ÙŠ', type: 'Ù…Ø´Ø±Ù', salary: 600, phone: null, note: '' });
s = D.fireEmployee(e3, e3.employees.find(e => e.name === 'Ù…Ø­Ù…Ø¯ Ø§Ù„Ø¹Ø¨Ø§Ø³ÙŠ').id); // fired -> monthly shows tiny salary history

// tiny helper: sell some stock items under a cashier
function sellDay(state, items, opts) {
  const opts2 = { items, who: 'Ø£Ø­Ù…Ø¯' };
  if (opts.customer) opts2.customer = opts.customer;
  if (opts.paid != null) opts2.paid = opts.paid;
  if (opts.discount) opts2.discount = opts.discount;
  if (opts.who) opts2.who = opts.who;
  if (opts.free) opts2.free = opts.free;
  return D.sellAll(state, opts2);
}

// =====================================================================
// DAY 1 â€” 2026-08-14 (previous month): opens, sells, refund, expense, check
// =====================================================================
// (entries keep real `at` for now â€” rewritten to the story dates at the end)
s = D.sellAll(s, { items: [{ id: P['Ù‚Ù‡ÙˆØ©'], qty: 12 }, { id: P['ÙƒÙˆÙƒØ§'], qty: 4 }], paid: 30, who: 'Ø£Ø­Ù…Ø¯' });
s = D.sellAll(s, { items: [{ id: P['Ø´Ø§ÙŠ'], qty: 5 }], paid: 5, who: 'Ù„ÙŠÙ„Ù‰' });
// a full-credit sale -> adds a debt to Salma, no cash in
s = D.sellAll(s, { items: [{ id: P['Ø³Ø§Ù†Ø¯ÙˆÙŠØªØ´ ØªÙˆÙ†Ø©'], qty: 2 }], customer: 'Ø³Ù„Ù…Ù‰', who: 'Ø£Ø­Ù…Ø¯' });
// refund one coffee (bought today) â€” needs the sale no
const day1Entries = s.day.entries;
s = D.refund(s, { items: [{ id: P['Ù‚Ù‡ÙˆØ©'], qty: 1 }], reason: 'Ø²Ø¨ÙˆÙ† Ø±Ø¬Ø¹Ù‡Ø§', saleNo: D.nextClientNo(s) - 1 });
// expense: electricity
s = D.expense(s, { amount: 20, note: 'ÙØ§ØªÙˆØ±Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¡ Ø§Ù„Ø´Ù‡Ø±', category: 'ÙÙˆØ§ØªÙŠØ±' });
// income: owner pocket money
s = D.income(s, { amount: 50, note: 'ÙÙ„ÙˆØ³ Ù…Ù† Ø¬ÙŠØ¨ Ø§Ù„Ù…Ø§Ù„Ùƒ', category: 'Ø£Ù…ÙˆØ§Ù„ Ø®Ø§ØµØ©' });
// buy stock (cash out)
s = D.buyStock(s, P['ÙƒÙˆÙƒØ§'], 10, 0.9);
s = D.buyStock(s, P['Ø´ÙŠØ¨Ø³'], 3, 0.7);   // chips stocked on day 1, sold out again day 2
// morning-count check: drawer has X
s = D.checkCash(s, { counted: D.cash(s) }); // exact match
s = D.closeDay(s); // -> closed, day 1 done

// =====================================================================
// DAY 2 â€” 2026-08-28: sales, partial debt pay, another check
// =====================================================================
s = D.sellAll(s, { items: [{ id: P['Ù‚Ù‡ÙˆØ©'], qty: 8 }, { id: P['Ù…Ø§Ø¡'], qty: 3 }], paid: 15, who: 'Ø£Ø­Ù…Ø¯' });
s = D.sellAll(s, { items: [{ id: P['Ø´ÙŠØ¨Ø³'], qty: 3 }], paid: 4.5, who: 'Ù„ÙŠÙ„Ù‰' }); // chips -> 0 again (sold-out demo for today)
// Salma pays half her 6 TND debt
const salmaDebt = D.getDebtByName(s, 'Ø³Ù„Ù…Ù‰');
s = D.payDebt(s, salmaDebt.id, { amount: 3 });
// flat discount sale
s = D.sellAll(s, { items: [{ id: P['ÙƒØ±ÙˆØ§Ø³ÙˆÙ†'], qty: 4 }], discount: { amount: 1 }, paid: 3.8, who: 'Ø£Ø­Ù…Ø¯' });
s = D.closeDay(s);

// =====================================================================
// DAY 3 â€” 2026-09-07: free-item sale + expense + check
// =====================================================================
s = D.sellFree(s, { name: 'Ù‚Ù‡ÙˆØ© Ù„Ù„Ø²Ø¨ÙˆÙ† Ø§Ù„Ø¶ÙŠÙ', qty: 1, price: 0, who: 'Ø£Ø­Ù…Ø¯' });
s = D.sellAll(s, { items: [{ id: P['Ø´Ø§ÙŠ'], qty: 6 }, { id: P['Ø­Ù„ÙŠØ¨'], qty: 2 }], paid: 9, who: 'Ù„ÙŠÙ„Ù‰' });
const day3 = D.cash(s);
s = D.checkCash(s, { counted: day3 + 0.5 }); // 0.5 off -> mismatch shows in report
s = D.expense(s, { amount: 15, note: 'Ù…Ù†Ø¸ÙØ§Øª', category: 'Ù…Ø´ØªØ±ÙŠØ§Øª Ù…Ø­Ù„' });
s = D.closeDay(s);

// =====================================================================
// DAY 4 â€” 2026-09-18: the week before today
// =====================================================================
s = D.sellAll(s, { items: [{ id: P['Ù‚Ù‡ÙˆØ©'], qty: 10 }], paid: 15, who: 'Ø£Ø­Ù…Ø¯' });
s = D.sellAll(s, { items: [{ id: P['ÙƒÙˆÙƒØ§'], qty: 2 }, { id: P['Ø³Ø¬Ø§Ø¦Ø±'], qty: 1 }], paid: 8.1, who: 'Ù„ÙŠÙ„Ù‰' });
// second debt: full credit to ÙØ±ÙŠØ¯
s = D.sellAll(s, { items: [{ id: P['Ø³Ø§Ù†Ø¯ÙˆÙŠØªØ´ ØªÙˆÙ†Ø©'], qty: 1 }], customer: 'ÙØ±ÙŠØ¯', who: 'Ø£Ø­Ù…Ø¯' });
s = D.closeDay(s);

// =====================================================================
// TODAY â€” 2026-09-21 (OPEN): morning cash = last day's endCash
// =====================================================================
s = D.sellAll(s, { items: [{ id: P['Ù‚Ù‡ÙˆØ©'], qty: 6 }], paid: 9, who: 'Ø£Ø­Ù…Ø¯' });
s = D.sellAll(s, { items: [{ id: P['Ø´Ø§ÙŠ'], qty: 4 }], paid: 4, who: 'Ù„ÙŠÙ„Ù‰' });
// a debt PAY today to show same-day payments
const faridDebt = D.getDebtByName(s, 'ÙØ±ÙŠØ¯');
if (faridDebt) s = D.payDebt(s, faridDebt.id, { amount: 3 });
// today's refund (of yesterday's coffee is not possible â€” refund must be same open day,
// so refund a qty of today's own stock only if it was sold today; skip to keep honest)

// ---------- THE STORY DATES (rewrite timestamps) ----------
const daysMap = [
  { idx: 0, date: '2026-08-14', span: 2 },
  { idx: 1, date: '2026-08-28', span: 2 },
  { idx: 2, date: '2026-09-07', span: 2 },
  { idx: 3, date: '2026-09-18', span: 2 }
];
// we closed 4 days; find them in order and give each a date + times
const closed = s.days.slice();
closed.forEach((d, i) => {
  const info = daysMap[i];
  d.date = info.date;
  d.openedAt = info.date + 'T07:' + String(10 + i).padStart(2, '0') + ':00.000Z';
  d.closedAt = info.date + 'T20:30:00.000Z';
  let t = 8 * 60; // minutes
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
// open day stays real-today; just make its entries slightly earlier today
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
const out = 'C:/Users/Dali/Projects/dekkan/seed-demo.json';
fs.writeFileSync(out, JSON.stringify(s, null, 2), 'utf8');

// prove restore + every report engine agrees
const r = D.restoreState(JSON.parse(JSON.stringify(s)));
const checks = {
  'restoreState': !!r,
  'stats.cash': D.cash(r),
  'dayReport today': D.dayReport(r).daySales,
  'past-day pick (09-07)': !!D.dayReportFor(r, '2026-09-07'),
  'monthly 2026-08 days': D.monthlyReport(r, '2026-08').days.length,
  'monthly 2026-09 days': D.monthlyReport(r, '2026-09').days.length,
  'clients': D.clientsReport(r).clients.map(c => c.name + ':' + c.owed).join(', '),
  'low stock': D.restockNeed(r).map(x => x.name).join(', '),
  'cashiers': D.cashierNames(r).join(', '),
  'debts open': r.debts.filter(d => d.total > d.paid).map(d => d.name).join(', '),
  'entries today': r.day.entries.length,
  'closed days': r.days.length
};
console.log(JSON.stringify(checks, null, 1));
const kinds = new Set(r.day.entries.map(e => e.kind));
r.days.forEach(d => d.entries.forEach(e => kinds.add(e.kind)));
console.log('entry kinds present:', [...kinds].join(', '));
