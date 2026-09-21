/* DEKKAN CORE — sales (deps: money, cash, pushEntry, ensureCustomer, rollover, getProduct, discountOff, addDebt, clone).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { money, cash, pushEntry, ensureCustomer, rollover, getProduct, discountOff, addDebt, clone } = K;


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
    // the per-day refund budget: how many of THIS product left the shelf today
    const sp = (state.day.soldByProduct = state.day.soldByProduct || {});
    sp[p.id] = (sp[p.id] || 0) + Math.floor(it.qty);
    refs.push(p.name + 'x' + Math.floor(it.qty));
  }
  for (const f of free) {
    if (!f || !f.name || !String(f.name).trim()) throw new Error('free item needs a name');
    if (!Number.isFinite(f.qty) || f.qty <= 0) throw new Error('free qty must be positive');
    if (!Number.isFinite(f.price) || f.price < 0) throw new Error('free price must be zero or more');
    revenue += money(f.price) * f.qty;
    const sf = (state.day.soldFree = state.day.soldFree || {});
    const fn = String(f.name).trim();
    sf[fn] = (sf[fn] || 0) + Math.floor(f.qty);
    refs.push(fn + 'x' + Math.floor(f.qty));
  }
  state.day.soldCost += money(cost);
  const net = money(revenue - discountOff(state, revenue, opts.discount));
  const disc = money(revenue - net);

  // the printable bill, built BEFORE the payment settles (everything the receipt shows)
  const lines = [];
  for (const it of items) {
    const unit = money(it.price != null ? it.price : getProduct(state, it.id).sell);
    lines.push({ id: it.id, name: getProduct(state, it.id).name, qty: Math.floor(it.qty), price: unit, total: money(unit * it.qty) });
  }
  for (const f of free) {
    lines.push({ name: String(f.name).trim(), qty: Math.floor(f.qty), price: money(f.price), total: money(f.price * f.qty) });
  }
  const paidVal = paidValOf(opts);
  const customer = String(opts.customer || opts.creditTo || '').trim();
  const cashIn = paidVal === null ? (customer ? 0 : net) : money(Math.min(paidVal, net));
  const bill = billOf(lines, disc, net, paidVal, cashIn);

  state = applyPayment(state, net, opts, refs.join(', '), bill);
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
    const sp = (state.day.soldByProduct = state.day.soldByProduct || {});
    sp[p.id] = (sp[p.id] || 0) + Math.floor(it.qty);
    refs.push(p.name + 'x' + Math.floor(it.qty));
  }
  state.day.soldCost += money(cost);
  const net = money(revenue - discountOff(state, revenue, opts.discount));
  const disc = money(revenue - net);

  const lines = [];
  for (const it of items) {
    const unit = money(it.price != null ? it.price : getProduct(state, it.id).sell);
    lines.push({ id: it.id, name: getProduct(state, it.id).name, qty: Math.floor(it.qty), price: unit, total: money(unit * it.qty) });
  }
  const paidVal = paidValOf(opts);
  const customer = String(opts.customer || opts.creditTo || '').trim();
  const cashIn = paidVal === null ? (customer ? 0 : net) : money(Math.min(paidVal, net));
  const bill = billOf(lines, disc, net, paidVal, cashIn);

  state = applyPayment(state, net, opts, refs.join(', '), bill);
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
  const disc = money(total - net);
  const sf = (state.day.soldFree = state.day.soldFree || {});
  const sfn = String(opts.name).trim();
  sf[sfn] = (sf[sfn] || 0) + qty;
  const paidVal = paidValOf(opts);
  const customer = String(opts.customer || opts.creditTo || '').trim();
  const cashIn = paidVal === null ? (customer ? 0 : net) : money(Math.min(paidVal, net));
  const bill = billOf(
    [{ name: String(opts.name).trim(), qty: qty, price: money(price), total: money(price * qty) }],
    disc, net, paidVal, cashIn
  );
  state = applyPayment(state, net, opts, opts.name + 'x' + qty, bill);
  return clone(state);
}


// ---------- the bill (what the receipt/facture prints, stored per sale) ----------

// lines: [{ name, qty, price, total }]  — the raw line items of this sale.
// paidVal: money handed over, or null when nothing was given (plain cash or credit).
// cashIn: what actually entered the till (min(paid, net), or net / 0).
// The bill NEVER changes the ledger math — it's the printable record of a sale.
function billOf(lines, discount, net, paidVal, cashIn) {
  return {
    lines: lines,
    discount: money(discount),
    net: money(net),
    paid: paidVal === null ? null : money(paidVal),
    rest: money(Math.max(0, net - cashIn)),
    change: money(Math.max(0, (paidVal === null ? 0 : paidVal) - net)) // cashIn is clamped; change is paid BEYOND the net
  };
}


function paidValOf(opts) {
  const v = opts.paid;
  if (v === undefined || v === null || v === '') return null;
  return money(Number(v));
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
function applyPayment(state, net, opts, refText, bill) {
  const customer = String(opts.customer || opts.creditTo || '').trim();
  const hasPaid = opts.paid !== undefined && opts.paid !== null && opts.paid !== '';
  if (!hasPaid) {
    if (customer) {
      pushEntry(state, 'sale', 0, refText, opts.note || customer, { bill: bill || null });
      state = ensureCustomer(state, customer, opts.phone);
      return addDebt(state, { name: customer, phone: opts.phone, amount: net, note: opts.note || refText });
    }
    pushEntry(state, 'sale', net, refText, opts.note || null, { bill: bill || null });
    return state;
  }
  const paid = money(Number(opts.paid));
  if (!Number.isFinite(paid) || paid < 0) throw new Error('paid must be zero or more');
  const cashIn = money(Math.min(paid, net));
  const left = money(net - cashIn);
  if (left > 0) {
    if (!customer) throw new Error('the unpaid rest needs a customer name');
    pushEntry(state, 'sale', cashIn, refText, opts.note || customer, { bill: bill || null });
    state = ensureCustomer(state, customer, opts.phone);
    return addDebt(state, { name: customer, phone: opts.phone, amount: left, note: opts.note || refText });
  }
  pushEntry(state, 'sale', cashIn, refText, opts.note || customer || null, { bill: bill || null });
  if (customer) state = ensureCustomer(state, customer, opts.phone);
  return state;
}

  K.sellAll = sellAll;
  K.sell = sell;
  K.sellFree = sellFree;
  K.billOf = billOf;
  K.paidValOf = paidValOf;
  K.applyPayment = applyPayment;
});
