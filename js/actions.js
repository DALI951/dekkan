/* DEKKAN UI — actions: every click/key handler that changes the shop state.
 * Split mechanically from js/app.js — bodies untouched, signatures became
 * (C, ...) with ctx destructured on the first line.
 * C = window.DEK.app (created by js/app.js): { state, basket, freeItems,
 * refundMode, refundProductId, editProductId, payDebtId, newDebtFlag,
 * receiptEntryId, $, T, D, save, run, render, toast }.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK) factory(root.DEK);
})(typeof self !== 'undefined' ? self : this, function (DEK) {
  'use strict';

  function press(C, id) {
    const { $ } = C;
    const el = $(id);
    if (typeof el.click === 'function') el.click();
    else el.fire('click');
  }
  function enterRuns(C, ids, action) {
    const { $ } = C;
    ids.forEach(function (id) {
      $(id).addEventListener('keydown', function (ev) {
        if (ev && ev.key === 'Enter') {
          if (ev.preventDefault) ev.preventDefault();
          action();
        }
      });
    });
  }

// Refund the sale shown on the receipt: restock its stock lines, clear its
  // free lines, and keep the paper trail. The entry id comes from the ticket
  // that opened this receipt (openTicket sets receiptEntryId). Money OUT — so
  // it waits for the owner lock first.
  function receiptRefund(C) {
    const { state, receiptEntryId, $, T, D, fmt, save, render, toast } = C;
    const { n3 } = fmt;
    const hideReceipt = DEK.pages.hideReceipt;
    const doRefund = function () {
      if (!receiptEntryId) return toast(T.t('toast.refundPick'), true);
      const entry = (state.day.entries || []).find(function (e) { return e.id === receiptEntryId; });
      if (!entry || !entry.bill) return toast(T.t('toast.couldntSave'), true);
      // A refund must undo EXACTLY what the sale did to the money:
      //   - paid in full, walk-in  → the same amount back out of the drawer
      //   - paid NOTHING + a name   → the debt goes down, the drawer never moves
      //   - paid PART + a name      → what was handed over comes back out AND the
      //     unpaid part is written off (the old code did only the second half of
      //     this: the FULL bill left the till and the debt stayed open).
      //   - a DISCOUNTED sale       → only what was really paid comes back. The
      //     line total is not the money: refunding a 100%-off sale used to take
      //     the full shelf price out of the drawer (found in the browser, 26-09).
      const bill = entry.bill;
      const onCredit = bill.rest > 0 && !!entry.note;
      const creditTo = onCredit ? String(entry.note) : null;
      // what physically entered the drawer for this sale
      const cashIn = bill.paid === null
        ? (entry.note ? 0 : n3(bill.net))        // a named sale that paid nothing: all credit
        : n3(Math.min(bill.paid, bill.net));      // a part payment: only what was handed over
      const items = [], freeNames = [];
      let freeQty = 0, freePrice = 0, itemsValue = 0;
      (entry.bill.lines || []).forEach(function (l) {
        if (l.id != null) { items.push({ id: l.id, qty: l.qty, price: l.price }); itemsValue += l.total || 0; }
        else { freeNames.push(l.name); freeQty += l.qty || 1; freePrice += l.total || l.price || 0; }
      });
      // a mixed bill (stock + free) is refunded in two calls, so the cash and the
      // credit are SPLIT by value — otherwise each call would take the whole
      // refund out of the drawer, twice.
      const share = function (value) {
        const whole = itemsValue + n3(freePrice);
        return whole > 0 ? n3(cashIn * n3(value) / whole) : 0;
      };
      const hadDiscount = (bill.discount || 0) > 0;
      try {
        let s = state;
        const saleNo = D.clientNoOf(state, receiptEntryId); // the # of the sale being reversed
        if (items.length) s = D.refund(s, { items: items, reason: 'refund', saleNo: saleNo, creditTo: creditTo, cash: share(itemsValue), discount: hadDiscount });
        if (freeNames.length) s = D.refundFree(s, { name: freeNames.join(' + '), qty: 1, price: n3(freePrice), saleNo: saleNo, creditTo: creditTo, cash: share(freePrice), discount: hadDiscount });
        C.state = s;
        save();
        C.receiptEntryId = null;
        hideReceipt(C);
        render();
        toast(T.t('toast.refundOk'));
      } catch (e) { toast(e.message, true); }
    };
    withPin(C, T.t('pin.refund'), doRefund);
  }

  // Cancel on the record-sale form: drop the whole order, reset the till, back to products.
  function cancelSell(C) {
    const { $, render, toast, T } = C;
    const hideReceipt = DEK.pages.hideReceipt;
    C.basket = []; C.freeItems = []; C.receiptEntryId = null;
    $('paidCash').value = ''; $('discPct').value = ''; $('discAmt').value = ''; $('creditName').value = '';
    hideReceipt(C); render(); toast(T.t('toast.saleCancelled'));
  }

  function doSell(C) {
    const { state, basket, freeItems, $, T, D, fmt, save, render, toast } = C;
    const { n3, money } = fmt;
    const showReceipt = DEK.pages.showReceipt;
    const customer = $('creditName').value.trim();

    const items = basket.map(function (b) { return { id: b.id, qty: b.qty }; });
    const free = freeItems.map(function (f) { return { name: f.name, price: f.price, qty: f.qty }; });
    if (items.length === 0 && free.length === 0) return toast(T.t('basket.empty'), true);

    const paidRaw = $('paidCash').value.trim();
    const paid = paidRaw === '' ? null : parseFloat(paidRaw);
    if (paid !== null && (!Number.isFinite(paid) || paid < 0)) return toast(T.t('toast.paidBad'), true);

    // the whole bill: stock + free, one discount — the SAME numbers the screen
    // is showing right now (one function, one answer; the discount is capped here)
    const q = DEK.pages.quote(C);
    const disc = q.disc, net = q.net;

    // whoever leaves ANY rest unpaid must give a name — that includes paying
    // nothing at all (full credit with an empty money field)
    const due = Math.max(0, net - (paid === null ? 0 : paid));
    if (due > 0 && !customer) {
      const nm = $('creditName');
      if (nm && nm.focus) nm.focus();
      return toast(T.t('toast.restName'), true);
    }

    // the lines of the receipt, from what's in the basket right now
    const lines = [];
    basket.forEach(function (b) {
      const p = D.getProduct(state, b.id);
      if (p) lines.push({ name: p.name, qty: b.qty, price: p.sell, total: n3(p.sell * b.qty) });
    });
    freeItems.forEach(function (f) { lines.push({ name: f.name, qty: f.qty, price: f.price, total: n3(f.price * f.qty) }); });

    // the number this client takes — captured BEFORE the sale records it
    const clientNo = D.nextClientNo(state);

    try {
      const opts = {
        customer: customer || undefined,
        discount: disc > 0
          ? (q.amt > 0 ? { amount: disc } : { percent: q.pct })
          : null,
        paid: paid === null ? undefined : paid,
        who: $('cashierName').value.trim() || undefined
      };
      if (items.length) opts.items = items;
      if (free.length) opts.free = free;
      C.state = D.sellAll(state, opts);
      save();

      // remember which entry the receipt just showed, so its refund button works
      const es = C.state.day.entries || [];
      C.receiptEntryId = es.length ? es[es.length - 1].id : null;

      const rest = net - (paid === null ? 0 : Math.min(paid, net));
      const change = (paid === null ? 0 : Math.max(0, paid - net));
      showReceipt(C, {
        customer: customer, no: clientNo, lines: lines,
        discount: n3(disc), net: net, paid: paid, rest: n3(rest), change: n3(change)
      });

      C.basket = []; C.freeItems = [];
      $('discPct').value = ''; $('discAmt').value = ''; $('creditName').value = ''; $('paidCash').value = '';
      render();
      if (rest > 0) toast(T.t('toast.saleRest') + money(rest) + (customer ? ' — ' + customer : ''));
      else if (customer) toast(T.t('toast.saleCredit') + customer);
      else toast(T.t('toast.saleOk'));
    } catch (e) { toast(e.message, true); }
  }

  function addFree(C) {
    const { $, T, freeItems, render, toast } = C;
    const name = $('freeName').value.trim();
    const priceRaw = $('freePrice').value;
    const qtyRaw = $('freeQty').value;
    // blank price = freebie (0); anything typed must be a real number >= 0
    const price = priceRaw === '' ? 0 : parseFloat(priceRaw);
    const qty = qtyRaw === '' ? 1 : parseFloat(qtyRaw);
    if (!name) return toast(T.t('toast.freeName'), true);
    if (!Number.isFinite(price) || price < 0) return toast(T.t('toast.freePrice'), true);
    if (!Number.isFinite(qty) || qty < 1) return toast(T.t('toast.freeQty'), true);
    freeItems.push({ name: name, price: price, qty: qty });
    $('freeName').value = ''; $('freePrice').value = '';
    render();
  }

  function toggleRefundMode(C) {
    const { render } = C;
    C.refundMode = !C.refundMode;
    C.refundProductId = null;
    render();
  }

  function doRefund(C) {
    const { state, refundProductId, $, T, D, run, toast } = C;
    if (!refundProductId) return toast(T.t('toast.refundPick'), true);
    const qty = parseFloat($('refundQty').value) || 1;
    const reason = $('refundReason').value.trim();
    const apply = function () {
      run(function (s) {
        return D.refund(s, { items: [{ id: refundProductId, qty: qty }], reason: reason || null });
      }, T.t('toast.refundOk'));
    };
    withPin(C, T.t('pin.refund'), apply);
  }

  function newProduct(C) {
    const { $, T } = C;
    const revealProductForm = DEK.pages.revealProductForm;
    C.editProductId = 'new';
    $('productFormTitle').textContent = T.t('stock.new');
    $('pName').value = ''; $('pBuy').value = ''; $('pSell').value = ''; $('pStock').value = '0'; $('pLow').value = '3';
    $('productForm').classList.remove('hidden');
    revealProductForm(C);
  }
  function cancelProduct(C) {
    const { $ } = C;
    C.editProductId = null;
    $('productForm').classList.add('hidden');
  }
  function saveProduct(C) {
    const { state, editProductId, $, T, D, save, render, toast } = C;
    const name = $('pName').value.trim();
    const buy = parseFloat($('pBuy').value) || 0;
    const sell = parseFloat($('pSell').value);
    const stock = parseInt($('pStock').value, 10) || 0;
    const lowAt = parseInt($('pLow').value, 10) || 0;
    try {
      if (!name) throw new Error(T.t('toast.prodName'));
      if (!(sell >= 0)) throw new Error(T.t('toast.prodPrice'));
      // a shelf cannot hold minus colas: typed a minus by accident, say so here
      if (stock < 0) throw new Error(T.t('toast.stockBad'));
      if (lowAt < 0) throw new Error(T.t('toast.stockBad'));
      if (editProductId === 'new') {
        C.state = D.addProduct(state, { name: name, buy: buy, sell: sell, stock: stock, lowAt: lowAt });
      } else {
        C.state = D.setProduct(state, editProductId, { name: name, buy: buy, sell: sell, stock: stock, lowAt: lowAt });
      }
      save(); C.editProductId = null;
      $('productForm').classList.add('hidden');
      render();
      toast(T.t('toast.savedOk'));
    } catch (e) { toast(e.message, true); }
  }

  // ----- staff (hire / edit / fire) -----
  function newEmployee(C) {
    const { $, T } = C;
    C.editEmployeeId = 'new';
    $('staffFormTitle').textContent = T.t('staff.new');
    $('empName').value = ''; $('empType').value = '';
    $('empSalary').value = ''; $('empPhone').value = ''; $('empNote').value = '';
    $('staffForm').classList.remove('hidden');
  }
  function cancelEmployee(C) {
    const { $ } = C;
    C.editEmployeeId = null;
    $('staffForm').classList.add('hidden');
  }
  function saveEmployee(C) {
    const { state, $, T, D, save, render, toast } = C;
    const name = $('empName').value.trim();
    const type = $('empType').value.trim();
    const raw = $('empSalary').value.trim();
    const salary = raw === '' ? 0 : parseFloat(raw);
    try {
      if (!name || !type) throw new Error(T.t('toast.empFields'));
      if (!(isFinite(salary) && salary >= 0)) throw new Error(T.t('toast.empSalary'));
      const fields = { name: name, type: type, salary: salary, phone: $('empPhone').value.trim(), note: $('empNote').value.trim() };
      if (C.editEmployeeId === 'new') {
        C.state = D.addEmployee(state, fields);
      } else {
        C.state = D.updateEmployee(state, C.editEmployeeId, fields);
      }
      save(); C.editEmployeeId = null;
      $('staffForm').classList.add('hidden');
      render();
      toast(T.t('toast.empSaved'));
    } catch (e) { toast(e.message, true); }
  }
  function fireEmployee(C, id) {
    const { state, $, T, D, save, render, toast } = C;
    try {
      C.state = D.fireEmployee(state, id);
      save(); C.editEmployeeId = null;
      $('staffForm').classList.add('hidden');
      render();
      toast(T.t('toast.empFired'));
    } catch (e) { toast(e.message, true); }
  }

  function openNewDebt(C) {
    const { $ } = C;
    const setNewDebt = DEK.pages.setNewDebt;
    setNewDebt(C, true);
    $('dName').value = ''; $('dAmount').value = ''; $('dPhone').value = ''; $('dNote').value = '';
  }
  function saveDebt(C) {
    const { $, T, D, run, toast } = C;
    const setNewDebt = DEK.pages.setNewDebt;
    const name = $('dName').value.trim();
    const amount = parseFloat($('dAmount').value) || 0;
    if (!name || amount <= 0) return toast(T.t('toast.debtName'), true);
    run(function (s) {
      return D.addDebt(s, { name: name, amount: amount, phone: $('dPhone').value.trim() || null, note: $('dNote').value.trim() || null });
    }, T.t('toast.debtOk'));
    setNewDebt(C, false);
  }
  function cancelPay(C) {
    const { $ } = C;
    C.payDebtId = null; $('payForm').classList.add('hidden');
  }
  function doPay(C) {
    const { state, payDebtId, $, T, D, fmt, run, toast } = C;
    const { n3, money } = fmt;
    const amount = parseFloat($('payAmount').value) || 0;
    if (amount <= 0) return toast(T.t('toast.amount'), true);
    // the only honest cap: you can never take more than the open balance
    const debt = state.debts.find(function (d) { return d.id === payDebtId; });
    const remaining = debt ? n3(debt.total - debt.paid) : 0;
    if (amount > remaining) return toast(T.t('toast.payOver') + money(remaining), true);
    run(function (s) { return D.payDebt(s, payDebtId, { amount: amount }); }, T.t('toast.payOk'));
    C.payDebtId = null;
    $('payForm').classList.add('hidden');
  }

  function addCat(C, side) {
    const { $, T, D, save, render, toast } = C;
    const inp = side === 'in' ? 'catInName' : 'catOutName';
    const v = $(inp).value.trim();
    if (!v) return;
    try {
      C.state = D.addCategory(C.state, { name: v, side: side });
      save();
      $(inp).value = '';
      render();
      toast(T.t('toast.catAdded'));
    } catch (err) {
      toast(T.t('toast.catDup'), true);
    }
  }
  function bookCash(C, side) {
    const { $, T, D, run } = C;
    const amt = parseFloat(side === 'in' ? $('cbInAmt').value : $('cbOutAmt').value);
    const note = (side === 'in' ? $('cbInSrc').value : $('cbOutPurpose').value).trim();
    const cat = (side === 'in' ? $('cbInCat').value : $('cbOutCat').value) || null;
    const opts = { amount: amt };
    if (note) opts.note = note;
    if (cat) opts.category = cat;
    run(function (s) { return side === 'in' ? D.income(s, opts) : D.expense(s, opts); },
      T.t(side === 'in' ? 'toast.cashIn' : 'toast.cashOut'));
    if (side === 'in') { $('cbInAmt').value = ''; $('cbInSrc').value = ''; }
    else { $('cbOutAmt').value = ''; $('cbOutPurpose').value = ''; }
  }

  function doCheckCash(C) {
    const { $, T, D, run, toast } = C;
    const counted = parseFloat($('countedCash').value);
    if (!(counted >= 0)) return toast(T.t('toast.checkAmt'), true);
    // A drawer count belongs to the day that is OPEN. Browsing a closed day and
    // counting used to file the count on TODAY while the panel showed that old
    // day's expected number — a silent lie in the one screen that guards the cash.
    const browsed = (C.reportDate || '').trim();
    if (browsed && browsed !== D.todayStr()) return toast(T.t('report.checkPastDay'), true);
    $('countedCash').value = '';
    run(function (s) { return D.checkCash(s, { counted: counted }); }, T.t('toast.checkOk'));
  }

  function saveCfg(C) {
    const { state, $, T, D, save, render, toast } = C;
    const name = $('cfgShopName').value.trim() || T.t('app.name');
    const start = parseFloat($('cfgStartCash').value) || 0;
    try {
      C.state = D.updateShop(state, { name: name, startCash: start });
      save(); render(); toast(T.t('toast.savedOk'));
    } catch (e) { toast(e.message, true); }
  }
  function toggleDiscount(C) {
    const { $, D, run } = C;
    run(function (s) { return D.setSettings(s, { allowDiscount: $('cfgDiscount').checked }); });
  }
  function toggleRefund(C) {
    const { $, D, run } = C;
    run(function (s) { return D.setSettings(s, { allowRefund: $('cfgRefund').checked }); });
  }
  function closeDay(C) {
    const { $, T, D, run } = C;
    // money bookkeeping is done — only the owner may shut the day
    withPin(C, T.t('pin.day'), function () {
      run(function (s) { return D.closeDay(s); }, T.t('toast.dayClosed'));
      $('countedCash').value = '';
    });
  }
  function undoLastSale(C) {
    const { T, D, run } = C;
    if (!D.canUndoSale(C.state)) return toast(T.t('toast.nothingUndo'), true);
    if (!confirm(T.t('toast.undoConfirm'))) return;
    const apply = function () {
      run(function (s) { return D.undoLastSale(s); }, T.t('toast.undoOk'));
      C.basket = []; C.freeItems = []; // the till resets with the undo
    };
    withPin(C, T.t('pin.undo'), apply);
  }
  function exportBackup(C) {
    const { state, D } = C;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dekkan-backup-' + D.todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  // Import: the file <input> lives in settings; once a file is picked we
  // validate the WHOLE backup before touching anything (core/restoreState),
  // then confirm, replace state, re-render. A bad file never changes state.
  function importBackup(C) {
    C.$('importFile').click();
  }
  function onImportFile(C, file) {
    const { T, D, save, render, toast } = C;
    const reader = new FileReader();
    reader.onload = function () {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (e) {
        toast(T.t('toast.importBad'), true);
        return;
      }
      try {
        parsed = D.restoreState(parsed);
      } catch (e) {
        toast(T.t('toast.importBad'), true);
        return;
      }
      if (!confirm(T.t('toast.importConfirm'))) return;
      // replacing the whole shop deserves the owner lock too
      withPin(C, T.t('pin.import'), function () {
        C.state = parsed;
        C.basket = [];
        C.freeItems = [];
        C.refundMode = false;
        save();
        render();
        toast(T.t('toast.importOk'));
      });
    };
    reader.onerror = function () { toast(T.t('toast.importBad'), true); };
    reader.readAsText(file);
  }
  function resetAll(C) {
    const { $, T, D, LS_KEY, BK_KEY, save, render, toast } = C;
    if (!confirm(T.t('toast.resetConfirm'))) return;
    const apply = function () {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(BK_KEY);
      C.state = D.createShop({ name: T.t('app.name') });
      C.basket = []; C.freeItems = [];
      save(); render();
      toast(T.t('toast.resetOk'));
    };
    withPin(C, T.t('pin.reset'), apply);
  }

  // ---------- owner lock ----------
  // When a PIN is armed, the money actions stop here until the keypad confirms.
  function withPin(C, label, fn) {
    if (C.D.hasPin(C.state)) { C.pinPending = fn; DEK.pages.openPin(C, label); }
    else fn();
  }
  function pinSet(C) {
    const { $, T, D, save, render, toast } = C;
    const pin = $('pinInput').value.trim();
    if (!/^\d{4,6}$/.test(pin)) return toast(T.t('pin.badFormat'), true);
    const apply = function () {
      try {
        C.state = D.setPin(C.state, pin);
        $('pinInput').value = '';
        save(); render(); toast(T.t('pin.saved'));
      } catch (e) { toast(e.message, true); }
    };
    // changing an armed PIN still needs the current one first
    withPin(C, T.t('pin.confirm'), apply);
  }
  function pinClear(C) {
    const { $, T, D, save, render, toast } = C;
    const apply = function () {
      C.state = D.clearPin(C.state);
      $('pinInput').value = '';
      save(); render(); toast(T.t('pin.cleared'));
    };
    withPin(C, T.t('pin.confirm'), apply);
  }

  // ---------- events (bound once) ----------
  function onClick(C, ev) {
    const { basket, $, T, D, render, run, save, toast } = C;
    const P = DEK.pages;
    const TH = C.themes();
    const sw = ev.target.closest('[data-theme]');
    if (sw) {
      if (TH && TH.set(sw.getAttribute('data-theme'))) {
        P.renderThemes(C);
        toast(T.t('toast.themeOk'));
      }
      return;
    }
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const act = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');
    const i = el.getAttribute('data-i');

    if (act === 'sell-add') P.addToBasket(C, id);

    if (act === 'basket-plus') P.addToBasket(C, id); // same guard as the tiles: never over the stock
    if (act === 'basket-minus') {
      const b = basket.find(function (x) { return x.id === id; });
      if (!b) return;
      b.qty--;
      if (b.qty <= 0) C.basket = basket.filter(function (x) { return x.id !== id; });
      render();
    }
    if (act === 'basket-free-del') { C.freeItems.splice(parseInt(i, 10), 1); render(); }

    if (act === 'refund-pick') {
      C.refundProductId = (C.refundProductId === id) ? null : id;
      render();
    }

    if (act === 'stock-edit') {
      const p = D.getProduct(C.state, id);
      C.editProductId = id;
      $('productFormTitle').textContent = T.t('stock.edit') + ': ' + p.name;
      $('pName').value = p.name; $('pBuy').value = p.buy; $('pSell').value = p.sell;
      $('pStock').value = p.stock; $('pLow').value = p.lowAt;
      $('productForm').classList.remove('hidden');
      P.revealProductForm(C); // the label only exists NOW — make sure it is actually on screen
    }
    if (act === 'stock-restock') run(function (s) { return D.buyStock(s, id, 10, D.getProduct(s, id).buy); }, T.t('toast.restock'));

    if (act === 'debt-pay') {
      C.payDebtId = id;
      const d = C.state.debts.find(function (x) { return x.id === id; });
      if (d) $('payTitle').textContent = T.t('debts.payTitle') + ' — ' + d.name;
      $('payAmount').value = '';
      $('payForm').classList.remove('hidden');
    }
    if (act === 'debt-del') withPin(C, T.t('pin.debt'), function () { run(function (s) { return D.removeDebt(s, id); }, T.t('toast.debtDeleted')); });

    if (act === 'ticket-day') { /* removed: past-day browsing merged into the open day */ }
    if (act === 'ticket-open') {
      const e = (C.state.day.entries || []).find(function (x) { return x.id === id; });
      if (e) P.openTicket(C, e, parseInt(i, 10) || 1);
    }
    if (act === 'metric-open') P.openMetric(C, el.getAttribute('data-metric') || id);
    if (act === 'restock-need') {
      // fill the shelf back to double its alert line right from the list
      const qty = parseInt(el.getAttribute('data-qty'), 10) || 10;
      const p = D.getProduct(C.state, id);
      if (p) {
        run(function (s) { return D.buyStock(s, id, qty, p.buy); },
          T.t('toast.restock') + ' ' + p.name + ' +' + qty);
        P.openMetric(C, 'low'); // refresh the list: it may already be empty
      }
    }
    if (act === 'cat-del') {
      try { C.state = D.removeCategory(C.state, { side: i, id: id }); save(); } catch (err) { /* already gone */ }
      render();
    }

    if (act === 'staff-edit') {
      const e = (C.state.employees || []).find(function (x) { return x.id === id; });
      if (!e) return;
      C.editEmployeeId = id;
      $('staffFormTitle').textContent = T.t('staff.edit') + ': ' + e.name;
      $('empName').value = e.name;
      $('empType').value = e.type;
      $('empSalary').value = String(e.salary);
      $('empPhone').value = e.phone;
      $('empNote').value = e.note;
      $('staffForm').classList.remove('hidden');
      render();
    }
    if (act === 'staff-fire') withPin(C, T.t('pin.fire'), function () { fireEmployee(C, id); });
  }

  DEK.actions = {
    press: press, enterRuns: enterRuns, receiptRefund: receiptRefund, cancelSell: cancelSell,
    doSell: doSell, addFree: addFree, toggleRefundMode: toggleRefundMode, doRefund: doRefund,
    newProduct: newProduct, cancelProduct: cancelProduct, saveProduct: saveProduct,
    openNewDebt: openNewDebt, saveDebt: saveDebt, cancelPay: cancelPay, doPay: doPay,
    addCat: addCat, bookCash: bookCash, doCheckCash: doCheckCash, saveCfg: saveCfg,
    toggleDiscount: toggleDiscount, toggleRefund: toggleRefund, closeDay: closeDay,
    undoLastSale: undoLastSale,
    exportBackup: exportBackup, importBackup: importBackup, onImportFile: onImportFile, resetAll: resetAll, onClick: onClick,
    newEmployee: newEmployee, cancelEmployee: cancelEmployee, saveEmployee: saveEmployee,
    fireEmployee: fireEmployee, withPin: withPin, pinSet: pinSet, pinClear: pinClear
  };
});