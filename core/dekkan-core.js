// DEKKAN CORE — the shop brain (dekkan = "shop" in Arabic/Tunisian dialect)
// Pure logic, zero UI. Every rule is a function on the state.
// Immutable style: functions take state, return a NEW state. Nothing mutates in place.
//
// THE ALGORITHM (the whole model in one paragraph):
//   - A shop has ONE cash box (caisse). Every money movement today is an ENTRY
//     with a signed amount: + = money IN (sale, debt payment, income),
//     - = money OUT (buying stock, expense, refund).
//   - cash is ALWAYS derived:  cash = startCash + sum(entries.amount).
//     We never store cash as its own number -> it can never drift out of sync.
//   - Products have stock. buyStock makes stock go up and cash go down.
//     sell makes stock go down and cash go up (or debt go up if it's a credit sale).
//     refund undoes a sale: cash out, goods back on the shelf, cost undone.
//   - discounts (percent or flat) reduce what the customer pays; cost is untouched.
//   - A day auto-closes and a new one opens the moment a write happens on a
//     new date. Closing cash of day N = starting cash of day N+1.
//   - EVERY customer of the day gets a client NUMBER (#1, #2, ...), counting
//     the sales of THIS day only. It resets to 1 each morning. One checkout
//     (sellAll) = ONE sale entry = one number, so the receipt always shows
//     the customer's number — with a name ("Mahmoud #3") or without ("#3").
//   - The CUSTOMER REGISTRY keeps names you've ever used (from sales and the
//     notebook) so the counter can suggest them while you type. Names are
//     never required: an unnamed sale is a walk-in customer.
//   - The shopkeeper can do a CASH CHECK: count the drawer, compare with the
//     computed cash. Every check is recorded in the day.
//   - profit for the day = money in - everything money went to
//       = (sales + debt payments - refunds) - cost of goods sold - expenses - stock buys

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

function createShop(opts) {
  opts = opts || {};
  const start = money(opts.startCash || 0);
  const now = new Date().toISOString();
  return {
    version: 3,
    shop: { name: opts.name || 'My Shop', currency: opts.currency || 'TND' },
    // Options the shopkeeper can turn on/off. The UI shows/hides them.
    settings: {
      allowDiscount: opts.allowDiscount !== undefined ? !!opts.allowDiscount : true,
      allowRefund: opts.allowRefund !== undefined ? !!opts.allowRefund : true
    },
    // every customer name ever used (sales + notebook) — the counter's memory
    customers: [],
    products: [],
    debts: [],
    days: [],
    // the OPEN day: entries (money moves) + checks (drawer counts) + soldCost (for profit)
    day: { date: todayStr(), openedAt: now, startCash: start, soldCost: 0, entries: [], checks: [] }
  };
}

// ---------- cash: the single source of truth ----------

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

// ---------- customers (the registry behind the counter's memory) ----------

// Remember a customer name so the counter can suggest it later.
// A name is optional for a sale (walk-in customer) — we only EVER record
// names that were actually typed. The registry is kept MOST-RECENT-FIRST:
// a returning customer jumps back to the top of the suggestions.
function ensureCustomer(state, name, phone) {
  state = rollover(clone(state));
  const trimmed = String(name || '').trim();
  if (!trimmed) return state;
  const low = trimmed.toLowerCase();
  const hitIdx = state.customers.findIndex(function (c) { return c.name.toLowerCase() === low; });
  if (hitIdx >= 0) {
    const hit = state.customers[hitIdx];
    state.customers.splice(hitIdx, 1);
    if (phone && !hit.phone) hit.phone = String(phone);
    hit.lastSeenAt = new Date().toISOString();
    state.customers.unshift(hit);
  } else {
    state.customers.unshift({
      id: uid(),
      name: trimmed,
      phone: phone || null,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });
  }
  return state;
}

// Every customer we've ever served, most recent first (for the datalist).
function customerNames(state) {
  return state.customers.map(function (c) { return c.name; });
}

// ---------- client numbers (the #1, #2, ... of today) ----------

// Count the numbered sales of TODAY. Each sellAll checkout = exactly ONE
// sale entry, so this count IS the day's client counter. If the open day
// is yesterday's, today simply hasn't sold anything yet.
function salesToday(state) {
  if (state.day.date !== todayStr()) return 0;
  let n = 0;
  for (const e of state.day.entries) if (e.kind === 'sale') n++;
  return n;
}

// The number the NEXT customer will get (#1 on a fresh day).
function nextClientNo(state) {
  return salesToday(state) + 1;
}

// The number of a specific sale entry (1-based within its day), or null.
function clientNoOf(state, entryId) {
  let n = 0;
  for (const e of state.day.entries) {
    if (e.kind !== 'sale') continue;
    n++;
    if (e.id === entryId) return n;
  }
  return null;
}

// ---------- day rollover ----------

// If the open day is not today, close it and open a fresh one.
// Closing cash of yesterday = starting cash of today. THE day boundary.
function closeOpenDay(state, closedAt) {
  const end = cash(state);
  state.days.push({
    date: state.day.date,
    openedAt: state.day.openedAt,
    closedAt: closedAt,
    startCash: state.day.startCash,
    endCash: end,
    soldCost: state.day.soldCost,
    entries: state.day.entries,
    checks: state.day.checks
  });
  state.day = { date: todayStr(), openedAt: closedAt, startCash: end, soldCost: 0, entries: [], checks: [] };
  return state;
}

function rollover(state) {
  if (state.day.date === todayStr()) return state;
  return closeOpenDay(state, new Date().toISOString());
}

// Force-close today even if it IS today (shop ends the day early -> new open day).
function closeDay(state) {
  state = clone(state);
  if (state.day.entries.length === 0 && state.day.soldCost === 0) return state; // nothing happened today, no empty day
  return closeOpenDay(state, new Date().toISOString());
}

// ---------- products ----------

function addProduct(state, p) {
  state = rollover(clone(state));
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
  const real = idTrusted(state, id);
  return state.products.find(function (x) { return x.id === real; });
}

function setProduct(state, id, patch) {
  state = rollover(clone(state));
  const p = getProduct(state, id);
  if (!p) throw new Error('product not found');
  if ('name' in patch && (typeof patch.name !== 'string' || !patch.name.trim())) throw new Error('name invalid');
  if ('sell' in patch && (typeof patch.sell !== 'number' || patch.sell < 0)) throw new Error('sell price invalid');
  if ('buy' in patch && (typeof patch.buy !== 'number' || patch.buy < 0)) throw new Error('buy price invalid');
  if ('stock' in patch && !Number.isFinite(patch.stock)) throw new Error('stock invalid');
  if ('lowAt' in patch && !Number.isFinite(patch.lowAt)) throw new Error('lowAt invalid');
  if ('stock' in patch) patch.stock = Math.floor(patch.stock);
  if ('lowAt' in patch) patch.lowAt = Math.floor(patch.lowAt);
  for (const k in patch) p[k] = patch[k];
  return state;
}

// Remove a product (only if it has no stock left — you can't delete what's in your shop).
function removeProduct(state, id) {
  state = rollover(clone(state));
  const p = getProduct(state, id);
  if (!p) throw new Error('product not found');
  if (p.stock > 0) throw new Error('product still has stock: ' + p.stock);
  state.products = state.products.filter(function (x) { return x.id !== p.id; });
  return state;
}

// ---------- discount (optional, toggleable via shop.settings.allowDiscount) ----------

// computes the money taken off a revenue. throws if discounts are turned off.
function discountOff(state, revenue, discountOrNull) {
  if (!discountOrNull) return 0;
  if (!state.settings.allowDiscount) throw new Error('discounts are turned off');
  if (discountOrNull.percent != null) {
    if (!Number.isFinite(discountOrNull.percent) || discountOrNull.percent < 0 || discountOrNull.percent > 100) {
      throw new Error('discount percent must be between 0 and 100');
    }
    return money(revenue * discountOrNull.percent / 100);
  }
  if (discountOrNull.amount != null) {
    if (!Number.isFinite(discountOrNull.amount) || discountOrNull.amount < 0) {
      throw new Error('discount amount must be a positive number');
    }
    return Math.min(money(discountOrNull.amount), revenue); // never below zero
  }
  throw new Error('discount needs percent or amount');
}

// ---------- money movements ----------

// Buying stock: cash out (-qty*unitBuy), product stock up.
function buyStock(state, productId, qty, unitBuy) {
  state = rollover(clone(state));
  const p = getProduct(state, productId);
  if (!p) throw new Error('product not found');
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty must be positive');
  const u = money(unitBuy);
  if (u < 0) throw new Error('unit buy price cannot be negative');
  const total = money(qty * u);
  p.stock += Math.floor(qty);
  pushEntry(state, 'buy', -total, productId, p.name + ' x' + Math.floor(qty));
  return state;
}

// How a sale gets paid — ONE place, so cash and debts can never disagree:
//   customer = the client's NAME (optional — walk-ins happen; Dali's rule).
//              creditTo is the old alias for "full credit on this name".
//   no paid, no customer -> plain cash sale (the till takes the whole net)
//   customer only        -> full credit (no cash moves, the whole net is debt)
//   paid = X (X < net)   -> PARTIAL: the till takes X, the rest (net - X) is
//                           debt on the customer (a name is required for it).
//   paid = X (X > net)   -> the till only ever keeps net; the extra is CHANGE
//                           the shop gives back, it never enters the cash box.
// A typed name is ALWAYS recorded (entry note + registry) — even for exact
// cash or overpay. The number on the receipt comes from the sale entry.
function applyPayment(state, net, opts, refText) {
  const customer = String(opts.customer || opts.creditTo || '').trim();
  const hasPaid = opts.paid !== undefined && opts.paid !== null && opts.paid !== '';
  if (!hasPaid) {
    if (customer) {
      pushEntry(state, 'sale', 0, refText, opts.note || customer);
      state = ensureCustomer(state, customer, opts.phone);
      return addDebt(state, { name: customer, phone: opts.phone, amount: net, note: opts.note || refText });
    }
    pushEntry(state, 'sale', net, refText, opts.note || null);
    return state;
  }
  const paid = money(Number(opts.paid));
  if (!Number.isFinite(paid) || paid < 0) throw new Error('paid must be zero or more');
  const cashIn = money(Math.min(paid, net));
  const left = money(net - cashIn);
  if (left > 0) {
    if (!customer) throw new Error('the unpaid rest needs a customer name');
    pushEntry(state, 'sale', cashIn, refText, opts.note || customer);
    state = ensureCustomer(state, customer, opts.phone);
    return addDebt(state, { name: customer, phone: opts.phone, amount: left, note: opts.note || refText });
  }
  pushEntry(state, 'sale', cashIn, refText, opts.note || customer || null);
  if (customer) state = ensureCustomer(state, customer, opts.phone);
  return state;
}

// FULL CHECKOUT — one customer, one bill, one numbered sale entry.
//   A basket can mix stock items ({id, qty, price?}) and free lines
//   ({name, price, qty}) — the discount cuts the WHOLE bill, payment is
//   settled once, and the entry (and its client #) is created once.
function sellAll(state, opts) {
  state = rollover(clone(state));
  opts = opts || {};
  const items = Array.isArray(opts.items) ? opts.items : [];
  const free = Array.isArray(opts.free) ? opts.free : [];
  if (items.length + free.length === 0) throw new Error('nothing to sell');

  let revenue = 0, cost = 0, refs = [];
  for (const it of items) {
    if (!Number.isFinite(it.qty) || it.qty <= 0) throw new Error('qty must be positive');
    if (it.price != null && (!Number.isFinite(it.price) || it.price < 0)) throw new Error('price must be zero or more');
    const p = getProduct(state, it.id);
    if (!p) throw new Error('product not found');
    if (p.stock < Math.floor(it.qty)) {
      throw new Error('not enough stock for ' + p.name + ' (have ' + p.stock + ', need ' + it.qty + ')');
    }
    const unit = money(it.price != null ? it.price : p.sell);
    revenue += unit * it.qty;
    cost += p.buy * it.qty;
    p.stock -= Math.floor(it.qty);
    refs.push(p.name + 'x' + Math.floor(it.qty));
  }
  for (const f of free) {
    if (!f || !f.name || !String(f.name).trim()) throw new Error('free item needs a name');
    if (!Number.isFinite(f.qty) || f.qty <= 0) throw new Error('free qty must be positive');
    if (!Number.isFinite(f.price) || f.price < 0) throw new Error('free price must be zero or more');
    revenue += money(f.price) * f.qty;
    refs.push(String(f.name).trim() + 'x' + Math.floor(f.qty));
  }
  state.day.soldCost += money(cost);
  const net = money(revenue - discountOff(state, revenue, opts.discount));

  state = applyPayment(state, net, opts, refs.join(', '));
  return clone(state);
}

// One sale, possibly many products at once (full basket at checkout).
//   items: [{ id, qty, price? }]   price = override if you sold above/below the normal price.
//   discount: { percent: 0..100 }  OR  { amount: TND }  (gated by settings)
//   creditTo: customer name -> sale goes to their DEBT instead of cash.
//   paid: cash handed over -> partial sale (rest becomes debt) or change.
function sell(state, opts) {
  state = rollover(clone(state));
  const items = (opts && opts.items) || [];
  if (items.length === 0) throw new Error('nothing to sell');

  let revenue = 0, cost = 0, refs = [];
  for (const it of items) {
    if (!Number.isFinite(it.qty) || it.qty <= 0) throw new Error('qty must be positive');
    if (it.price != null && (!Number.isFinite(it.price) || it.price < 0)) throw new Error('price must be zero or more');
    const p = getProduct(state, it.id);
    if (!p) throw new Error('product not found');
    if (p.stock < Math.floor(it.qty)) {
      throw new Error('not enough stock for ' + p.name + ' (have ' + p.stock + ', need ' + it.qty + ')');
    }
    const unit = money(it.price != null ? it.price : p.sell);
    revenue += unit * it.qty;
    cost += p.buy * it.qty;
    p.stock -= Math.floor(it.qty);
    refs.push(p.name + 'x' + Math.floor(it.qty));
  }
  state.day.soldCost += money(cost);
  const net = money(revenue - discountOff(state, revenue, opts.discount));

  state = applyPayment(state, net, opts, refs.join(', '));
  return clone(state);
}

// Selling something with NO stock tracking (coffee, a service, a haircut).
function sellFree(state, opts) {
  state = rollover(clone(state));
  if (!opts || !opts.name || !opts.name.trim()) throw new Error('need an item name');
  const qty = Math.floor(opts.qty || 1);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty must be positive');
  const price = opts.price != null ? opts.price : 0;
  if (!Number.isFinite(price) || price < 0) throw new Error('price must be zero or more');
  const total = money(price * qty);
  const net = money(total - discountOff(state, total, opts.discount));
  state = applyPayment(state, net, opts, opts.name + 'x' + qty);
  return clone(state);
}

// REFUND — the customer brings it back.
//   For a normal sale: cash back, goods back on the shelf, cost undone.
//   For a credit sale (creditTo): no cash moves, their debt goes back down.
function refund(state, opts) {
  state = rollover(clone(state));
  if (!state.settings.allowRefund) throw new Error('refunds are turned off');
  const items = (opts && opts.items) || [];
  if (items.length === 0) throw new Error('nothing to refund');

  let back = 0, costBack = 0, refs = [];
  for (const it of items) {
    if (!Number.isFinite(it.qty) || it.qty <= 0) throw new Error('refund qty must be positive');
    const p = getProduct(state, it.id);
    if (!p) throw new Error('product not found');
    const unit = money(it.price != null ? it.price : p.sell);
    back += unit * it.qty;
    costBack += p.buy * it.qty;
    p.stock += Math.floor(it.qty); // goods go back on the shelf
    refs.push(p.name + 'x' + Math.floor(it.qty));
  }
  // the cost of those goods is undone (can't go below 0 for today's report)
  state.day.soldCost = money(Math.max(0, state.day.soldCost - costBack));

  if (opts.creditTo) {
    // was a credit sale -> undo it on the (open) debt, no cash moves
    const d = getDebtByName(state, opts.creditTo);
    if (!d) throw new Error('no open debt for ' + opts.creditTo);
    const maxBack = money(d.total - d.paid); // don't take the debt below what's already paid off
    const applied = Math.min(back, maxBack);
    d.total = money(d.total - applied);
    if (d.total <= d.paid) d.settled = true;
    pushEntry(state, 'refund', 0, refs.join(', '), 'credit refund: ' + opts.creditTo);
  } else {
    pushEntry(state, 'refund', -money(back), refs.join(', '), opts.reason || null);
  }
  return state;
}

// Refund something that was sold without stock tracking (service returned / wrong order).
function refundFree(state, opts) {
  state = rollover(clone(state));
  if (!state.settings.allowRefund) throw new Error('refunds are turned off');
  if (!opts || !opts.name || !opts.name.trim()) throw new Error('need an item name');
  const qty = Math.floor(opts.qty || 1);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('refund qty must be positive');
  const back = money((opts.price || 0) * qty);
  if (opts.creditTo) {
    const d = getDebtByName(state, opts.creditTo);
    if (!d) throw new Error('no open debt for ' + opts.creditTo);
    const maxBack = money(d.total - d.paid);
    const applied = Math.min(back, maxBack);
    d.total = money(d.total - applied);
    if (d.total <= d.paid) d.settled = true;
    pushEntry(state, 'refund', 0, opts.name + 'x' + qty, 'credit refund: ' + opts.creditTo);
  } else {
    pushEntry(state, 'refund', -back, opts.name + 'x' + qty, opts.note || null);
  }
  return state;
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
  const real = idTrusted(state, id);
  return state.debts.find(function (x) { return x.id === real; });
}

function getDebtByName(state, name) {
  const n = String(name).toLowerCase();
  return state.debts.find(function (x) { return x.name.toLowerCase() === n && !x.settled; });
}

function addDebt(state, opts) {
  state = rollover(clone(state));
  if (!opts || !opts.name || !opts.name.trim()) throw new Error('debt needs a customer name');
  const amount = money(opts.amount || 0);
  if (amount <= 0) throw new Error('debt amount must be positive');
  const d = getDebt(state, opts.debtId) || getDebtByName(state, opts.name);
  if (d) {
    d.total = money(d.total + amount);
    d.payments.push({ amount: amount, at: new Date().toISOString(), kind: 'debt', note: opts.note || null });
  } else {
    state.debts.push({
      id: uid(),
      name: opts.name.trim(),
      phone: opts.phone || null,
      total: amount,
      paid: 0,
      payments: [{ amount: amount, at: new Date().toISOString(), kind: 'debt', note: opts.note || null }],
      createdAt: new Date().toISOString(),
      settled: false
    });
  }
  return ensureCustomer(state, opts.name, opts.phone);
}

// Customer pays what they owe: cash IN, debt down. Handles partial payments.
function payDebt(state, debtId, opts) {
  state = rollover(clone(state));
  const d = getDebt(state, debtId);
  if (!d) throw new Error('debt not found');
  const remaining = money(d.total - d.paid);
  if (remaining <= 0) throw new Error('this debt is already settled');
  let amount = money((opts && opts.amount) || 0);
  if (amount <= 0) throw new Error('payment must be positive');
  const pay = Math.min(amount, remaining); // can't overpay -> the excess stays in the customer's pocket
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

// Remove a settled debt from the notebook (records-keeping: you can't delete what's owed).
function removeDebt(state, debtId) {
  state = rollover(clone(state));
  const d = getDebt(state, debtId);
  if (!d) throw new Error('debt not found');
  if (d.total - d.paid > 0) throw new Error('debt still has an open balance (use payDebt)');
  state.debts = state.debts.filter(function (x) { return x.id !== d.id; });
  return state;
}

// ---------- CASH CHECK: shopkeeper counts the drawer, we compare ----------

// counted = the real money physically in the drawer right now.
// The check is recorded (amount 0, so the cash identity is untouched),
// and the day report shows expected vs counted vs the difference.
function checkCash(state, opts) {
  state = rollover(clone(state));
  const counted = money(opts && opts.counted);
  if (!Number.isFinite(counted)) throw new Error('counted must be a number');
  const expected = cash(state);
  const diff = money(counted - expected);
  state.day.checks.push({ at: new Date().toISOString(), counted: counted, expected: expected, diff: diff, ok: diff === 0 });
  pushEntry(state, 'check', 0, null, 'counted ' + counted + ', diff ' + (diff >= 0 ? '+' : '') + diff);
  return state;
}

// ---------- shop identity & options (the small-print settings) ----------

// Rename the shop / set the day's starting cash.
//   startCash can ONLY change while the day is empty (no entries yet) —
//   otherwise the cash identity (startCash + sum of moves) would be corrupted retroactively.
function updateShop(state, opts) {
  state = clone(state);
  if (!opts) return state;
  if (opts.name != null) {
    if (typeof opts.name !== 'string' || !opts.name.trim()) throw new Error('shop name invalid');
    state.shop.name = opts.name.trim();
  }
  if (opts.startCash != null) {
    if (!Number.isFinite(opts.startCash) || opts.startCash < 0) throw new Error('start cash invalid');
    if (state.day.entries.length > 0 || state.day.soldCost > 0) {
      throw new Error('day already has movement — start cash is locked for today');
    }
    state.day.startCash = money(opts.startCash);
  }
  return state;
}

// Turn shop options on/off (allowDiscount, allowRefund). UI shows/hides them.
function setSettings(state, patch) {
  state = clone(state);
  if (!patch) return state;
  if ('allowDiscount' in patch) {
    if (typeof patch.allowDiscount !== 'boolean') throw new Error('allowDiscount must be boolean');
    state.settings.allowDiscount = patch.allowDiscount;
  }
  if ('allowRefund' in patch) {
    if (typeof patch.allowRefund !== 'boolean') throw new Error('allowRefund must be boolean');
    state.settings.allowRefund = patch.allowRefund;
  }
  return state;
}

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

// ---------- deep helpers ----------

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

// accept either the id string itself or { id } — small convenience
function idTrusted(state, id) {
  if (id && typeof id === 'object' && id.id) return id.id;
  return id;
}

// ---------- export: node (tests) + browser (the app later) ----------

const api = {
  createShop, addProduct, setProduct, removeProduct, getProduct,
  buyStock, sell, sellAll, sellFree, refund, refundFree, expense, income,
  addDebt, payDebt, getDebt, getDebtByName, debtsOwed, removeDebt,
  ensureCustomer, customerNames,
  salesToday, nextClientNo, clientNoOf,
  updateShop, setSettings,
  checkCash, stats, dayReport, cash, closeDay, rollover, todayStr
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Dekkan = api;