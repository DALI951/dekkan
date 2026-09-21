/* DEKKAN CORE — refunds (deps: money, cash, pushEntry, rollover, getProduct, sell, getDebtByName, clone).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { money, cash, pushEntry, rollover, getProduct, sell, getDebtByName, clone } = K;


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
    const take = Math.floor(it.qty);
    // you can only give back what actually left the shelf today
    const broad = (state.day.soldByProduct = state.day.soldByProduct || {});
    const sold = broad[p.id] || 0;
    if (take > sold) throw new Error('refund qty exceeds what was sold today for ' + p.name + ' (sold ' + sold + ')');
    broad[p.id] = sold - take;
    const unit = money(it.price != null ? it.price : p.sell);
    back += unit * take;
    costBack += p.buy * take;
    p.stock += take; // goods go back on the shelf
    refs.push(p.name + 'x' + take);
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
    pushEntry(state, 'refund', 0, refs.join(', '), 'credit refund: ' + opts.creditTo, { saleNo: opts.saleNo || null });
  } else {
    // cash back — but the till must physically hold it first
    const now = cash(state);
    if (money(back) > now) throw new Error('not enough cash in the till to refund (' + money(now) + ')');
    pushEntry(state, 'refund', -money(back), refs.join(', '), opts.reason || null, { saleNo: opts.saleNo || null });
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
  // the free-item budget, by NAME — you can only give back what was sold today
  const broad = (state.day.soldFree = state.day.soldFree || {});
  const sfn = String(opts.name).trim();
  const sold = broad[sfn] || 0;
  if (qty > sold) throw new Error('refund qty exceeds what was sold today for ' + sfn + ' (sold ' + sold + ')');
  broad[sfn] = sold - qty;
  const back = money((opts.price || 0) * qty);
  if (opts.creditTo) {
    const d = getDebtByName(state, opts.creditTo);
    if (!d) throw new Error('no open debt for ' + opts.creditTo);
    const maxBack = money(d.total - d.paid);
    const applied = Math.min(back, maxBack);
    d.total = money(d.total - applied);
    if (d.total <= d.paid) d.settled = true;
    pushEntry(state, 'refund', 0, sfn + 'x' + qty, 'credit refund: ' + opts.creditTo, { saleNo: opts.saleNo || null });
  } else {
    const now = cash(state);
    if (money(back) > now) throw new Error('not enough cash in the till to refund (' + money(now) + ')');
    pushEntry(state, 'refund', -back, sfn + 'x' + qty, opts.note || null, { saleNo: opts.saleNo || null });
  }
  return state;
}

  K.refund = refund;
  K.refundFree = refundFree;
});
