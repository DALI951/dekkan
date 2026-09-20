/* DEKKAN CORE — report (deps: money, cash, refund, expense, income, debtsOwed, salariesFor).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { money, cash, refund, expense, income, debtsOwed, salariesFor } = K;


// ---------- the daily REPORT (how the money moved today) ----------

function dayReport(state) {
  let sales = 0, debtPays = 0, refunds = 0, buys = 0, expenses = 0, incomes = 0, checkCount = 0;
  for (const e of state.day.entries) {
    if (e.kind === 'sale') sales += e.amount;
    else if (e.kind === 'debt-pay') debtPays += e.amount;
    else if (e.kind === 'refund') refunds += -e.amount;
    else if (e.kind === 'buy') buys += -e.amount;
    else if (e.kind === 'expense') expenses += -e.amount;
    else if (e.kind === 'income') incomes += e.amount;
    else if (e.kind === 'check') checkCount++;
  }
  let inventory = 0, lowStock = [];
  for (const p of state.products) {
    inventory += p.stock * p.buy;
    if (p.lowAt > 0 && p.stock <= p.lowAt) lowStock.push(p);
  }
  sales = money(sales);
  debtPays = money(debtPays);
  refunds = money(refunds);
  buys = money(buys);
  expenses = money(expenses);
  incomes = money(incomes);
  const costOfSold = money(state.day.soldCost);
  const gross = money(sales + debtPays);        // everything that came in from selling today
  const net = money(gross - refunds);           // after giving refunds back

  return {
    date: state.day.date,
    openedAt: state.day.openedAt,
    shop: state.shop,
    currency: state.shop.currency,

    // the cashbox story: started here, ended here, and every single move between
    // (sale moves carry their client number of the day: #1, #2, ...)
    startCash: state.day.startCash,
    cash: cash(state),
    entries: (function () {
      let n = 0;
      return state.day.entries.map(function (e) {
        if (e.kind === 'sale') n++;
        return { id: e.id, kind: e.kind, amount: e.amount, at: e.at, ref: e.ref, note: e.note, no: e.kind === 'sale' ? n : null };
      });
    })(),
    checks: state.day.checks.map(function (c) { return { at: c.at, counted: c.counted, expected: c.expected, diff: c.diff, ok: c.ok }; }),
    lastCheck: state.day.checks.length ? state.day.checks[state.day.checks.length - 1] : null,

    totals: { sales: sales, debtPays: debtPays, refunds: refunds, buys: buys, expenses: expenses, incomes: incomes, checks: checkCount },

    // the money lines
    grossSales: gross,
    netSales: net,
    daySales: gross,            // v1-compatible name
    dayRefunds: refunds,
    dayBuys: buys,
    dayExpenses: expenses,
    dayIncomes: incomes,
    costOfSold: costOfSold,

    // the shelf
    inventoryValue: money(inventory),
    lowStock: lowStock,

    // the notebook
    debts: { total: money(debtsOwed(state)), count: state.debts.filter(function (x) { return !x.settled; }).length },

    // THE profit line: money in - everything money went to
    dayProfit: money(net - costOfSold - buys - expenses)
  };
}


// stats = the daily report (v1 name kept for compatibility)
function stats(state) {
  return dayReport(state);
}


// ---------- the MONTHLY report (the month in review) ----------

const pad2 = n => (n < 10 ? '0' : '') + n;

// 'YYYY-MM' of a stamp, IN LOCAL TIME (the same clock the shopkeeper sees)
function monthKey(iso) {
  if (typeof iso !== 'string' || !iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

// local 'YYYY-MM-DD' of a stamp — the key of one day row
function locDay(iso) {
  const d = new Date(iso);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// The whole month over the SAME ledger the day report reads (day.entries plus
// every closed day). Wins = money in (sales + debt pays + other income);
// losses = money out (refunds + buys + expenses + the month's salaries);
// profit = the difference. per-day rows carry only the cash moved that day.
function monthlyReport(state, ym) {
  const r = {
    month: ym,
    sales: 0, debtPays: 0, incomes: 0,
    refunds: 0, buys: 0, expenses: 0,
    salaries: money(salariesFor(state, ym)),
    moves: 0, wins: 0, losses: 0, profit: 0,
    days: []
  };
  const days = {};

  const feed = function (entries) {
    (entries || []).forEach(function (e) {
      if (!e || e.kind === 'check') return;      // drawer counts are not money
      if (monthKey(e.at) !== ym) return;         // asked for another month
      r.moves++;
      const out = e.amount < 0;
      const abs = out ? -e.amount : e.amount;
      if (e.kind === 'sale') r.sales += e.amount;
      else if (e.kind === 'debt-pay') r.debtPays += e.amount;
      else if (e.kind === 'income') r.incomes += e.amount;
      else if (e.kind === 'refund') r.refunds += abs;
      else if (e.kind === 'buy') r.buys += abs;
      else if (e.kind === 'expense') r.expenses += abs;
      // every move walks into its day row too
      const key = locDay(e.at);
      const row = days[key] = days[key] || { date: key, in: 0, out: 0 };
      if (out) row.out += abs; else row.in += abs;
    });
  };

  feed(state.day.entries);
  (state.days || []).forEach(function (d) { feed(d.entries); });

  r.sales = money(r.sales);
  r.debtPays = money(r.debtPays);
  r.incomes = money(r.incomes);
  r.refunds = money(r.refunds);
  r.buys = money(r.buys);
  r.expenses = money(r.expenses);
  r.salaries = money(r.salaries);
  r.wins = money(r.sales + r.debtPays + r.incomes);
  r.losses = money(r.refunds + r.buys + r.expenses + r.salaries);
  r.profit = money(r.wins - r.losses);
  r.days = Object.keys(days).sort().map(function (k) {
    const row = days[k];
    return { date: k, in: money(row.in), out: money(row.out) };
  });
  return r;
}

  K.dayReport = dayReport;
  K.stats = stats;
  K.monthlyReport = monthlyReport;
});
