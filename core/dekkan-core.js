// DEKKAN CORE — the shop brain (دكان = shop)
// Pure logic, zero UI. Every rule is a function on the state.
// Immutable style: functions take state, return a NEW state. Nothing mutates in place.
//
// THE ALGORITHM (the whole model in one paragraph):
//   - A shop has ONE cash box (caisse). Every money movement today is an ENTRY
//     with a signed amount: + = money IN (sale, debt payment, income),
//     - = money OUT (buying stock, expense).
//   - cash is ALWAYS derived:  cash = startCash + sum(entries.amount).
//     We never store cash as its own number -> it can never drift out of sync.
//   - Products have stock. buyStock makes stock go up and cash go down.
//     sell makes stock go down and cash go up (or debt go up if it's a credit sale).
//   - A day auto-closes and a new one opens the moment a write happens on a
//     new date. Closing cash of day N = starting cash of day N+1.
//   - profit for the day = sales revenue - cost of goods sold - expenses - stock buys.

'use strict';

// ---------- tiny helpers ----------

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// Local calendar date, YYYY-MM-DD (the day a caisse is judged on).
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Round money to 3 decimals (TND has millimes).
function money(n) {
  return Math.round(n * 1000) / 1000;
}

// ---------- state ----------

// The one and only state object. `days` = closed days (history), day = the open day.
//   days: [ { date, startCash, endCash, soldCost, entries: [...] } ]
//   day:  { date, startCash, soldCost, entries: [...] }
function createShop(opts) {
  opts = opts || {};
  const start = money(opts.startCash || 0);
  const now = new Date().toISOString();
  return {
    version: 1,
    shop: { name: opts.name || 'My Shop', currency: opts.currency || 'TND' },
    products: [],
    debts: [],
    days: [],
    day: { date: todayStr(), openedAt: now, startCash: start, soldCost: 0, entries: [] }
  };
}

// ---------- cash: the single source of truth ----------

// The cash box value. NEVER store this — always derive.
function cash(state) {
  let total = state.day.startCash;
  for (const e of state.day.entries) total += e.amount;
  return money(total);
}

function pushEntry(state, kind, amount, ref, note) {
  state.day.entries.push({
    id: uid(), kind, amount: money(amount), at: new Date().toISOString(), ref: ref || null, note: note || null
  });
  return state;
}

// ---------- day rollover ----------

// If the open day is not today, close it and open a fresh one.
// Closing cash of yesterday = starting cash of today. THE day boundary.
function rollover(state) {
  if (state.day.date === todayStr()) return state;
  const end = cash(state);
  state.days.push({
    date: state.day.date,
    openedAt: state.day.openedAt,
    closedAt: new Date().toISOString(),
    startCash: state.day.startCash,
    endCash: end,
    soldCost: state.day.soldCost,
    entries: state.day.entries
  });
  state.day = { date: todayStr(), openedAt: new Date().toISOString(), startCash: end, soldCost: 0, entries: [] };
  return state;
}

// Force-close today even if it IS today (shop ends the day early -> new open day).
function closeDay(state) {
  state = clone(state);
  if (state.day.entries.length === 0 && state.day.soldCost === 0) return state; // nothing happened today, no empty day
  const end = cash(state);
  state.days.push({
    date: state.day.date,
    openedAt: state.day.openedAt,
    closedAt: new Date().toISOString(),
    startCash: state.day.startCash,
    endCash: end,
    soldCost: state.day.soldCost,
    entries: state.day.entries
  });
  state.day = { date: todayStr(), openedAt: new Date().toISOString(), startCash: end, soldCost: 0, entries: [] };
  return state;
}

// ---------- products ----------

function addProduct(state, p) {
  state = rollover(productClone(state));
  if (!p || typeof p.name !== 'string' || !p.name.trim()) throw new Error('product needs a name');
  if (typeof p.sell !== 'number' || p.sell < 0) throw new Error('product needs a valid sell price');
  state.products.push({
    id: uid(),
    name: p.name.trim(),
    buy: money(p.buy || 0),
    sell: money(p.sell),
    stock: Math.floor(p.stock || 0),
    lowAt: Math.floor(p.lowAt || 0)
  });
  return state;
}

function getProduct(state, id) {
  return state.products.find((x) => x.id === id);
}

function setProduct(state, id, patch) {
  state = rollover(productClone(state));
  const p = getProduct(state, id);
  if (!p) throw new Error('product ' + id + ' not found');
  if ('name' in patch && (typeof patch.name !== 'string' || !patch.name.trim())) throw new Error('name invalid');
  if ('sell' in patch && (typeof patch.sell !== 'number' || patch.sell < 0)) throw new Error('sell price invalid');
  if ('buy' in patch && (typeof patch.buy !== 'number' || patch.buy < 0)) throw new Error('buy price invalid');
  if ('stock' in patch) patch.stock = Math.floor(patch.stock);
  if ('lowAt' in patch) patch.lowAt = Math.floor(patch.lowAt);
  Object.assign(p, patch);
  return state;
}

// Remove a product (only if it has no stock left — you can't delete what's in your shop).
function removeProduct(state, id) {
  state = rollover(productClone(state));
  const p = getProduct(state, id);
  if (!p) throw new Error('product ' + id + ' not found');
  if (p.stock > 0) throw new Error('product still has stock: ' + p.stock);
  state.products = state.products.filter((x) => x.id !== id);
  return state;
}

// ---------- money movements ----------

// Buying stock: cash out (-qty*unitBuy), product stock up.
function buyStock(state, productId, qty, unitBuy) {
  state = rollover(clone(state));
  const p = getProduct(state, idTrusted(state, productId));
  if (!p) throw new Error('product not found');
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty must be positive');
  const u = money(unitBuy);
  if (u < 0) throw new Error('unit buy price cannot be negative');
  const total = money(qty * u);
  p.stock += Math.floor(qty);               // you stocked up
  pushEntry(state, 'buy', -total, productId, p.name + ' x' + Math.floor(qty));
  return state;
}

// One sale, possibly many products at once (full basket at checkout).
//   items: [{ id, qty, price? }]   price = override if you sold above/below the normal price.
//   creditTo: customer name -> sale goes to their DEBT instead of cash.
function sell(state, opts) {
  state = rollover(clone(state));
  const items = (opts && opts.items) || [];
  if (items.length === 0) throw new Error('nothing to sell');

  let revenue = 0, cost = 0, refs = [];
  for (const it of items) {
    if (!Number.isFinite(it.qty) || it.qty <= 0) throw new Error('qty must be positive');
    const p = getProduct(state, idTrusted(state, it.id));
    if (!p) throw new Error('product not found');
    if (p.stock < Math.floor(it.qty)) throw new Error('not enough stock for ' + p.name + ' (have ' + p.stock + ', need ' + it.qty + ')');
    const unit = money(it.price != null ? it.price : p.sell);
    revenue += unit * it.qty;
    cost += p.buy * it.qty;
    p.stock -= Math.floor(it.qty);
    refs.push(p.name + 'x' + Math.floor(it.qty));
  }
  state.day.soldCost += money(cost);
  if (opts.creditTo) {
    // Credit sale: no cash moves, the customer OWES us now.
    pushEntry(state, 'sale', 0, refs.join(', '), 'credit: ' + opts.creditTo); // 0-cash marker entry
    state = addDebt(state, { name: opts.creditTo, phone: opts.phone, amount: revenue, note: opts.note || (refs.join(', ')) });
  } else {
    pushEntry(state, 'sale', revenue, refs.join(', '), opts.note || null);
  }
  return clone(state);
}

// Selling something with NO stock tracking (coffee, a service, a haircut).
function sellFree(state, opts) {
  state = rollover(clone(state));
  if (!opts || !opts.name || !opts.name.trim()) throw new Error('need an item name');
  const qty = Math.floor(opts.qty || 1);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty must be positive');
  const price = money(opts.price || 0);
  const total = money(price * qty);
  if (opts.creditTo) {
    pushEntry(state, 'sale', 0, opts.name + 'x' + qty, 'credit: ' + opts.creditTo);
    state = addDebt(state, { name: opts.creditTo, phone: opts.phone, amount: total, note: opts.note || opts.name });
  } else {
    pushEntry(state, 'sale', total, opts.name + 'x' + qty, opts.note || null);
  }
  return clone(state);
}

// Shop expenses (rent, electricity, coffee for the owner...). Cash out.
function expense(state, opts) {
  state = rollover(clone(state));
  if (!opts || !Number.isFinite(opts.amount) || opts.amount <= 0) throw new Error('expense amount must be positive');
  pushEntry(state, 'expense', -money(opts.amount), null, opts.note || null);
  return state;
}

// Money you put INTO the cash box from outside (your pocket, a loan). Cash in.
function income(state, opts) {
  state = rollover(clone(state));
  if (!opts || !Number.isFinite(opts.amount) || opts.amount <= 0) throw new Error('income amount must be positive');
  pushEntry(state, 'income', money(opts.amount), null, opts.note || null);
  return state;
}

// ---------- debts (the notebook, digitized) ----------

function getDebt(state, id) {
  return state.debts.find((x) => x.id === id);
}

function addDebt(state, opts) {
  state = rollover(clone(state));
  if (!opts || !opts.name || !opts.name.trim()) throw new Error('debt needs a customer name');
  const amount = money(opts.amount || 0);
  if (amount <= 0) throw new Error('debt amount must be positive');
  const d = getDebt(state, idTrusted(state, opts.debtId)) || getDebtByName(state, opts.name);
  if (d) {
    d.total = money(d.total + amount);
    d.payments.push({ amount, at: new Date().toISOString(), kind: 'debt', note: opts.note || null });
  } else {
    state.debts.push({
      id: uid(),
      name: opts.name.trim(),
      phone: opts.phone || null,
      total: amount,
      paid: 0,
      payments: [{ amount, at: new Date().toISOString(), kind: 'debt', note: opts.note || null }],
      createdAt: new Date().toISOString(),
      settled: false
    });
  }
  return state;
}

function getDebtByName(state, name) {
  return state.debts.find((x) => x.name.toLowerCase() === String(name).toLowerCase() && !x.settled);
}

// Customer pays what they owe: cash IN, debt down. Handles partial payments.
function payDebt(state, debtId, opts) {
  state = rollover(clone(state));
  const d = getDebt(state, idTrusted(state, debtId));
  if (!d) throw new Error('debt not found');
  const remaining = money(d.total - d.paid);
  if (remaining <= 0) throw new Error('this debt is already settled');
  let amount = money((opts && opts.amount) || 0);
  if (amount <= 0) throw new Error('payment must be positive');
  const pay = Math.min(amount, remaining); // can't overpay -> returns the excess automatically
  d.paid = money(d.paid + pay);
  d.payments.push({ amount: -pay, at: new Date().toISOString(), kind: 'pay', note: (opts && opts.note) || null });
  if (d.paid >= d.total) d.settled = true;
  pushEntry(state, 'debt-pay', pay, d.name, 'debt payment');
  return state;
}

function debtsOwed(state) {
  let total = 0;
  for (const d of state.debts) if (!d.settled) total += d.total - d.paid;
  return money(total);
}

// ---------- the numbers (stats) ----------

// All the numbers for a daily report. teach-side: everything derives from the state.
function stats(state) {
  let sales = 0, buys = 0, expenses = 0, incomes = 0;
  for (const e of state.day.entries) {
    if (e.kind === 'sale') sales += e.amount;
    else if (e.kind === 'buy') buys += -e.amount;
    else if (e.kind === 'expense') expenses += -e.amount;
    else if (e.kind === 'income') incomes += e.amount;
    else if (e.kind === 'debt-pay') sales += e.amount; // money from debt payments is real revenue today
  }
  let inventory = 0, lowStock = [];
  for (const p of state.products) {
    inventory += p.stock * p.buy;
    if (p.lowAt > 0 && p.stock <= p.lowAt) lowStock.push(p);
  }
  sales = money(sales);
  buys = money(buys);
  expenses = money(expenses);
  incomes = money(incomes);
  const costOfSold = money(state.day.soldCost);
  return {
    cash: cash(state),
    startCash: state.day.startCash,
    daySales: sales,
    dayBuys: buys,
    dayExpenses: expenses,
    dayIncomes: incomes,
    costOfSold,
    inventoryValue: money(inventory),
    lowStock,
    debts: {
      total: money(debtsOwed(state)),
      count: state.debts.filter((x) => !x.settled).length
    },
    // THE profit line: money in - everything money went to.
    dayProfit: money(sales - costOfSold - buys - expenses)
  };
}

// ---------- deep helpers (kept out of the hot path) ----------

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}
function productClone(state) {
  return clone(state);
}
// accept either the id string itself or { id } — small DX nicety
function idTrusted(state, id) {
  if (id && typeof id === 'object' && id.id) return id.id;
  return id;
}

// ---------- export: node (tests) + browser (the app later) ----------

const api = {
  createShop, addProduct, setProduct, removeProduct, getProduct,
  buyStock, sell, sellFree, expense, income,
  addDebt, payDebt, getDebt, debtsOwed, stats, cash, closeDay, rollover, todayStr
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Dekkan = api;