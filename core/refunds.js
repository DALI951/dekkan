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
//   For a PART-paid sale (creditTo AND cash): the drawer gives back exactly what
//   came in and the unpaid part is written off the notebook. That is the only
//   honest way round — a customer who handed 1.000 of a 3.000 bill and gets the
//   goods back must not walk out with 3.000 out of the drawer, and must not keep
//   owing 2.000 for goods that are back on the shelf.
//   opts.cash = how much leaves the drawer (default: all of it). Anything the
//   rest does not cover is taken off opts.creditTo's debt.
//   opts.discount = true when the bill was discounted, so the gap between the
//   shelf price and the money taken is the discount, not an unpaid debt.

// one settlement, shared by refund() and refundFree(): `back` is what the goods
// are worth, `cashOut` how much of it physically leaves the drawer, `allowGap`
// says the leftover is a DISCOUNT the customer was given (so it is simply not
// returned) and not a debt he owes — without it, a 50%-off sale could not be
// refunded at all: the shelf price minus the money taken looked like credit.
function _settle(state, back, cashOut, creditTo, note, refs, saleNo, allowGap) {
  // no `cash` given + a creditTo = the old dictation: the whole return is written
  // off the notebook and the drawer never moves. `cash` is what unlocks the split.
  const out = cashOut == null ? (creditTo ? 0 : money(back)) : money(cashOut);
  if (out < 0) throw new Error('refund cash must be zero or more');
  if (out > money(back)) throw new Error('refund cash cannot be more than the value coming back');
  const credit = money(money(back) - out);
  if (out > 0) {
    // cash back — but the till must physically hold it first
    const now = cash(state);
    if (out > now) throw new Error('not enough cash in the till to refund (' + money(now) + ')');
  }
  if (credit > 0) {
    if (creditTo) {
      const d = getDebtByName(state, creditTo);
      if (!d) throw new Error('no open debt for ' + creditTo);
      const maxBack = money(d.total - d.paid); // don't take the debt below what's already paid off
      d.total = money(d.total - Math.min(credit, maxBack));
      if (d.total <= d.paid) d.settled = true;
    } else if (!allowGap) {
      throw new Error('part of this refund was on credit — no customer to write it off');
    }
  }
  const note2 = credit > 0 && creditTo ? 'credit refund: ' + creditTo : (note || null);
  pushEntry(state, 'refund', -out, refs, note2, { saleNo: saleNo || null });
  return state;
}

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
    return _settle(state, back, opts.cash, opts.creditTo, opts.reason, refs.join(', '), opts.saleNo, opts.discount === true);
  }
  return _settle(state, back, opts.cash, null, opts.reason, refs.join(', '), opts.saleNo, opts.discount === true);
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
    return _settle(state, back, opts.cash, opts.creditTo, opts.note, sfn + 'x' + qty, opts.saleNo, opts.discount === true);
  }
  return _settle(state, back, opts.cash, null, opts.note, sfn + 'x' + qty, opts.saleNo, opts.discount === true);
}

  K.refund = refund;
  K.refundFree = refundFree;
});
