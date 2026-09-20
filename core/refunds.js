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
    pushEntry(state, 'refund', 0, refs.join(', '), 'credit refund: ' + opts.creditTo, { saleNo: opts.saleNo || null });
  } else {
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
  const back = money((opts.price || 0) * qty);
  if (opts.creditTo) {
    const d = getDebtByName(state, opts.creditTo);
    if (!d) throw new Error('no open debt for ' + opts.creditTo);
    const maxBack = money(d.total - d.paid);
    const applied = Math.min(back, maxBack);
    d.total = money(d.total - applied);
    if (d.total <= d.paid) d.settled = true;
    pushEntry(state, 'refund', 0, opts.name + 'x' + qty, 'credit refund: ' + opts.creditTo, { saleNo: opts.saleNo || null });
  } else {
    pushEntry(state, 'refund', -back, opts.name + 'x' + qty, opts.note || null, { saleNo: opts.saleNo || null });
  }
  return state;
}

  K.refund = refund;
  K.refundFree = refundFree;
});
