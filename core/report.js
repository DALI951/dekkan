/* DEKKAN CORE — report (deps: money, cash, refund, expense, income, debtsOwed).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { money, cash, refund, expense, income, debtsOwed } = K;


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

  K.dayReport = dayReport;
  K.stats = stats;
});
