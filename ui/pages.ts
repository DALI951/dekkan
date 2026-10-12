// @ts-nocheck
// JS -> TS migration (first pass): this file is the dynamic DOM / service-worker /
// vm-harness layer (loose globals + event targets). Types get tightened incrementally.
/* DEKKAN UI — pages: every renderer and modal lightbox, one per page.
 * Split mechanically from ui/app.js — bodies untouched, only each function's
 * signature changed to (C) with its ctx needs destructured on the first line.
 * C = window.DEK.app (created by ui/app.js): { state, basket, freeItems,
 * refundMode, refundProductId, editProductId, payDebtId, newDebtFlag,
 * receiptEntryId, storageRead, $, T, D, version, save, run, render, toast }.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK) factory(root.DEK);
})(typeof self !== 'undefined' ? self : this, function (DEK) {
  'use strict';

  function render(C) {
    const { renderHeader, renderSell, renderStock, renderDebts, renderClients, renderReport, renderCashBox, renderSettings, renderEmployees, renderMonthly } = DEK.pages;
    if (C.fmt && C.fmt._setCustom) C.fmt._setCustom(C.state.custom);
    renderHeader(C);
    renderSell(C);
    renderStock(C);
    renderDebts(C);
    renderClients(C);
    renderReport(C);
    renderCashBox(C);
    renderSettings(C);
    renderEmployees(C);
    renderMonthly(C);
  }

  function renderHeader(C) {
    const { state, $, T, D, fmt } = C;
    const { money } = fmt;
    const name = shopTitle(state, T.t('app.name'));
    $('shopName').textContent = name;
    if ($('sideTitle')) $('sideTitle').textContent = name;
    if ($('sideTag')) $('sideTag').textContent = shopTagline(state, T.t('app.tagline'));
    const initial = shopInitial(state, T.t('app.name'));
    if ($('sideLogo')) $('sideLogo').textContent = initial;
    if ($('topLogo')) $('topLogo').textContent = initial;
    const cash = money(D.cash(state));
    $('cashNow').textContent = cash;
    if ($('cashNow2')) $('cashNow2').textContent = cash;
    $('todayLine').textContent = T.t('today') + D.todayStr();
  }

  // ---------- ONE quote for the whole till ----------
  // What the screen shows and what the till charges used to be computed TWICE
  // (here for the number, in ui/actions.js for the sale). They drifted: type a
  // discount over 100% and the screen said 0.000 while the core refused the sale
  // with an english error. One function, one answer — the discount is capped
  // here, exactly like it is displayed.
  function quote(C) {
    const { state, basket, freeItems, $, fmt, D } = C;
    const n3 = fmt.n3;
    const subtotal = basket.reduce(function (a, b) {
      const p = D.getProduct(state, b.id);
      return a + (p ? p.sell * b.qty : 0);
    }, 0) + freeItems.reduce(function (a, f) { return a + f.price * f.qty; }, 0);
    const rawPct = parseFloat($('discPct').value) || 0;
    const amt = parseFloat($('discAmt').value) || 0;
    const pct = Math.max(0, Math.min(100, rawPct));   // 150% off == the whole bill, not an error
    const disc = n3(amt > 0 ? Math.min(amt, subtotal) : Math.min(subtotal * pct / 100, subtotal));
    return {
      subtotal: subtotal, pct: pct, rawPct: rawPct, amt: amt, disc: disc,
      net: n3(Math.max(0, subtotal - disc))
    };
  }

  // ----- SELL -----
  /* Settings > "Refunds allowed": with the feature turned OFF the buttons
     leave the screen entirely — a button that looks alive and refuses is
     worse than no button at all (Dali, 2026-10-11). The core stays the
     authority; this is the visible half of the same switch.

     what the customer must hand over — right there, and it moves while you type */
  function renderSell(C) {
    const { state, basket, freeItems, refundMode, refundProductId, $, T, D, fmt } = C;
    const { money, n3, esc, stockLeft } = fmt;
    const P = DEK.pages;
    const canRefund = state.settings.allowRefund !== false;
    $('btnRefundMode').classList.toggle('hidden', !canRefund);
    $('btnRefundMode').classList.toggle('on', refundMode && canRefund);
    $('refundPanel').classList.toggle('hidden', !refundMode || !canRefund);

    const q = (($('sellSearch') || {}).value || '').trim().toLowerCase();
    const listed = q ? (D.searchProducts ? D.searchProducts(state, q) : state.products) : state.products;

    let html = '';
    listed.forEach(function (p) {
      if (q && p.name.toLowerCase().indexOf(q) < 0 && (p.sku || '').toLowerCase().indexOf(q) < 0) return;
      const low = p.lowAt > 0 && p.stock <= p.lowAt;
      const out = p.stock <= 0;
      html += '<button class="sell-tile' + (out ? ' out' : '') + '" data-id="' + p.id + '"' + (out ? ' disabled' : '') + ' data-action="sell-add">'
        + '<span class="t-name">' + esc(p.name) + '</span>'
        + '<span class="t-price">' + money(p.sell) + '</span>'
        + '<span class="t-stock' + (low ? ' low' : '') + '">' + stockLeft(p.stock) + '</span>'
        + '</button>';
    });
    $('sellGrid').innerHTML = html || '<div class="empty">' + T.t('sell.none') + '</div>';

    const lowN = D.restockNeed(state);
    const banner = $('lowBanner');
    if (banner) {
      banner.classList.toggle('hidden', lowN.length === 0);
      if (lowN.length) {
        banner.textContent = T.t('sell.lowBanner').replace('{n}', String(lowN.length));
      }
    }

    let rh = '';
    state.products.forEach(function (p) {
      rh += '<button class="sell-tile' + (refundProductId === p.id ? ' refundable' : '') + '" data-id="' + p.id + '" data-action="refund-pick">'
        + '<span class="t-name">' + esc(p.name) + '</span>'
        + '<span class="t-stock">' + stockLeft(p.stock) + '</span>'
        + '</button>';
    });
    $('refundGrid').innerHTML = rh || '<div class="empty">' + T.t('sell.none') + '</div>';

    const count = basket.reduce(function (a, b) { return a + b.qty; }, 0) +
      freeItems.reduce(function (a, b) { return a + b.qty; }, 0);
    $('basketCount').textContent = count;

    let bh = '';
    basket.forEach(function (b) {
      const p = D.getProduct(state, b.id);
      if (!p) return;
      bh += '<div class="basket-line"><span>' + esc(p.name) + ' <span class="q">x' + b.qty + '</span></span>'
        + '<span class="sub">' + money(b.qty * p.sell) + '</span>'
        + '<span class="row gap"><button class="btn ghost" data-action="basket-minus" data-id="' + b.id + '">−</button> '
        + '<button class="btn ghost" data-action="basket-plus" data-id="' + b.id + '">+</button></span></div>';
    });
    freeItems.forEach(function (f, i) {
      bh += '<div class="basket-line"><span>' + esc(f.name) + ' <span class="q">x' + f.qty + '</span></span>'
        + '<span class="sub">' + money(f.qty * f.price) + '</span>'
        + '<button class="btn ghost" data-action="basket-free-del" data-i="' + i + '">✕</button></div>';
    });
    $('basketList').innerHTML = bh || '<div class="empty">' + T.t('basket.empty') + '</div>';

    const bill = quote(C);
    const disc = bill.disc, net = bill.net;
    $('discountRow').classList.toggle('hidden', !state.settings.allowDiscount);
    $('basketTotal').textContent = money(net);

    const parts = [];
    if (count > 0) parts.push(count + ' ' + T.t('sell.items'));
    if (disc > 0) parts.push(T.t('sell.discount') + ' ' + money(disc));
    $('dueBox').classList.toggle('empty', net <= 0);
    $('dueHint').textContent = net > 0 ? parts.join('  ·  ') : T.t('sell.nothingYet');

    $('queueLine').textContent = T.t('sell.nextClient') + ' #' + D.nextClientNo(state);

    $('customerList').innerHTML = D.customerNames(state).map(function (n) {
      return '<option value="' + esc(n) + '"></option>';
    }).join('');
    const cl = $('cashierList');
    if (cl) cl.innerHTML = D.cashierNames(state).map(function (n) {
      return '<option value="' + esc(n) + '"></option>';
    }).join('');
    P.fillListHints(C);

    var ci = $('cashierName');
    if (ci && ci.dataset && !ci.dataset.touched) {
      const last = D.cashierNames(state)[0];
      if (last) ci.value = last;
    }

    P.renderChange(C, net);
    P.renderFreePrev(C);
  }

  // live line for the no-stock item form (price x qty, while you type)
  function renderFreePrev(C) {
    const { $, fmt } = C;
    const { money } = fmt;
    const el = $('freePrev');
    if (!el) return;
    const name = $('freeName').value.trim();
    const price = parseFloat($('freePrice').value) || 0;
    const qty = parseInt($('freeQty').value, 10) || 0;
    if (!name) { el.className = 'line-prev hidden'; return; }
    el.className = 'line-prev';
    el.textContent = name + '  ×' + qty + '  =  ' + money(price * qty);
  }

  // Live till line: what the customer handed over vs what they owe / get back.
  function renderChange(C, net) {
    const { $, T, fmt } = C;
    const { n3, money } = fmt;
    const el = $('changeLine');
    if (!el) return;
    const raw = $('paidCash').value.trim();
    const name = $('creditName').value.trim();
    let txt = '', cls = 'chg';
    if (raw === '') {
      if (net > 0) {
        txt = name
          ? T.t('sell.onCredit') + ' ' + name
          : T.t('sell.rest') + ' ' + money(net) + ' — ' + T.t('sell.restNeedName');
        cls += name ? ' warn' : ' bad';
      }
    } else {
      const paid = parseFloat(raw);
      if (!Number.isFinite(paid) || paid < 0) {
        txt = T.t('toast.paidBad'); cls += ' bad';
      } else if (paid >= net) {
        const back = n3(paid - net);
        if (back > 0) { txt = T.t('sell.change') + ' ' + money(back); cls += ' ok'; }
        else { txt = T.t('sell.exact'); cls += ' ok'; }
      } else {
        txt = T.t('sell.rest') + ' ' + money(net - paid) + ' — '
          + (name || T.t('sell.restNeedName'));
        cls += ' bad';
      }
    }
    el.className = txt ? cls : 'chg hidden';
    el.textContent = txt;
  }

  function addToBasket(C, id) {
    const { state, basket, $, T, D, toast, render } = C;
    const p = D.getProduct(state, id);
    if (!p) return;
    if (p.stock <= 0) return toast(T.t('toast.noStock'), true); // sold out — the tile is disabled too
    const hit = basket.find(function (b) { return b.id === id; });
    const qty = (hit ? hit.qty : 0) + 1;
    if (qty > p.stock) return toast(T.t('toast.maxStock') + p.stock, true); // never more than on the shelf
    if (hit) hit.qty = qty;
    else basket.push({ id: id, qty: 1 });
    render();
  }

  // ----- STOCK -----
  function renderStock(C) {
    const { state, $, T, fmt } = C;
    const { money, esc } = fmt;
    let html = '';
    state.products.forEach(function (p) {
      const low = p.lowAt > 0 && p.stock <= p.lowAt;
      html += '<div class="stock-card"><span>'
        + '<span class="s-name">' + esc(p.name) + '</span>'
        + '<span class="s-meta">' + T.t('stock.buy') + ' ' + money(p.buy) + '  •  ' + T.t('stock.sell') + ' ' + money(p.sell) + (p.unit ? ' / ' + esc(p.unit) : '') + '</span></span>'
        + '<span class="row gap"><span class="s-stock' + (low ? ' low' : '') + '">' + p.stock + '</span>'
        + '<button class="btn ghost" data-action="stock-card" data-id="' + p.id + '">' + T.t('stock.card') + '</button>'
        + '<button class="btn ghost" data-action="stock-edit" data-id="' + p.id + '">' + T.t('stock.edit') + '</button>'
        + '<button class="btn ghost" data-action="stock-restock" data-id="' + p.id + '">+10</button>'
      + '<button class="btn ghost" data-action="buy-open" data-id="' + p.id + '">' + T.t('buy.title') + '</button></span></div>';
    });
    $('stockList').innerHTML = html || '<div class="empty">' + T.t('stock.empty') + '</div>';
    DEK.pages.fillListHints(C);
  }

  // ----- DEBTS -----
  function renderDebts(C) {
    const { state, newDebtFlag, payDebtId, $, T, fmt } = C;
    const { money, esc } = fmt;
    const open = state.debts.filter(function (d) { return !d.settled; });
    const settled = state.debts.filter(function (d) { return d.settled; });
    let html = '';
    open.forEach(function (d) {
      const owed = d.total - d.paid;
      html += '<div class="debt-card"><span><span class="d-name">' + esc(d.name) + '</span>'
        + '<span class="d-sub">' + T.t('debts.paid') + ' ' + money(d.paid) + '</span></span>'
        + '<span class="row gap"><span class="d-owed">' + money(owed) + '</span>'
        + '<button class="btn primary" data-action="debt-pay" data-id="' + d.id + '">' + T.t('debts.pay') + '</button>'
        + '</span></div>';
    });
    settled.forEach(function (d) {
      html += '<div class="debt-card"><span><span class="d-name">' + esc(d.name) + '</span>'
        + '<span class="d-sub">' + T.t('debts.settled') + '</span></span>'
        + '<span class="row gap"><span class="d-owed">' + money(d.paid) + '</span>'
        + '<button class="btn ghost" data-action="debt-del" data-id="' + d.id + '">✕</button></span></div>';
    });
    $('debtList').innerHTML = html || '<div class="empty">' + T.t('debts.empty') + '</div>';
    $('debtForm').classList.toggle('hidden', !newDebtFlag);
    $('payForm').classList.toggle('hidden', !payDebtId);
  }

  function setNewDebt(C, v) {
    const { $ } = C;
    const { renderDebts } = DEK.pages;
    C.newDebtFlag = v;
    if (!v) { C.payDebtId = null; $('payForm').classList.add('hidden'); }
    renderDebts(C);
  }

  // ----- CLIENTS -----
  function renderClients(C) {
    const { state, $, T, D, fmt } = C;
    const { money, esc, entryTime } = fmt;
    const report = D.clientsReport(state);
    const kindName = function (k) {
      return k === 'sale' ? T.t('clients.purchase')
        : k === 'refund' ? T.t('clients.refund')
        : k === 'debt-add' ? T.t('clients.debtAdd')
        : k === 'debt-pay' ? T.t('clients.debtPay')
        : k;
    };
    $('clientsList').innerHTML = report.clients.map(function (c) {
      const rows = c.history.map(function (h) {
        const cls = h.kind === 'refund' ? 'bad' : (h.kind === 'debt-add' ? 'bad' : 'in');
        return '<div class="entry"><span class="e-kind k-' + (h.kind === 'debt-add' ? 'debt' : h.kind) + '">' + kindName(h.kind) + '</span>'
          + (h.saleNo ? '<span class="e-no">#' + h.saleNo + '</span>' : '')
          + '<span class="growx"><span class="e-time">' + entryTime(h.at) + '</span>'
          + (h.lines ? '<span class="e-note">' + esc(h.lines) + '</span>' : '') + '</span>'
          + '<span class="e-amt ' + cls + '">' + money(h.amount) + '</span></div>';
      }).join('') || '<div class="empty">' + T.t('clients.noHistory') + '</div>';
      return '<div class="card client-card">'
        + '<h3>' + esc(c.name) + (c.phone ? ' <small class="muted">' + esc(c.phone) + '</small>' : '') + '</h3>'
        + '<div class="grid3">'
        + '<div class="metric"><span class="lab">' + T.t('clients.purchases') + '</span><b class="val ok">' + money(c.purchases) + '</b></div>'
        + '<div class="metric"><span class="lab">' + T.t('clients.refunds') + '</span><b class="val bad">' + money(c.refunds) + '</b></div>'
        + '<div class="metric"><span class="lab">' + T.t('clients.owed') + '</span><b class="val bad">' + money(c.owed) + '</b></div>'
        + '</div>'
        + '<div class="rows">' + rows + '</div>'
        + '</div>';
    }).join('') || '<div class="card empty">' + T.t('clients.empty') + '</div>';
  }

  // ----- REPORT -----
  /* the fat-finger valve: only on the LIVE day, and only when the very last move is a sale */
  function renderReport(C) {
    const { state, $, T, D, fmt } = C;
    const { money, n3, fmt: f3, esc, entryTime, kindLabel } = fmt;
    const date = (C.reportDate || '').trim();
    const r = date ? D.dayReportFor(state, date) : D.stats(state);
    if (!r) { // picked a date that has no day (junk input) — fall back to today
      C.reportDate = '';
      const $p = $('dayPicker'); if ($p) $p.value = '';
      return DEK.pages.render(C);
    }
    if (C._lastReportDate !== date) {
      const $p = $('dayPicker');
      if ($p) $p.value = date || '';
      C._lastReportDate = date;
    }

    $('tillCard').innerHTML =
      '<div class="tilth">' + (date ? T.t('report.chip.closed') : T.t('report.chip.now')) + '</div>'
      + '<div class="tillnum">' + money(r.cash) + '</div>'
      + '<div class="tillsub">' + T.t('report.chip.start') + ' <b>' + money(r.startCash) + '</b>'
      + '  ·  ' + T.t('report.chip.profit')
      + ' <b class="' + (r.dayProfit >= 0 ? 'ok' : 'bad') + '">' + money(r.dayProfit) + '</b></div>';

    const chips = [
      [T.t('report.chip.inventory'), money(r.inventoryValue), '', 'inventory'],
      [T.t('report.chip.debts'), money(r.debts.total), r.debts.count ? 'bad' : '', 'debts'],
      [T.t('report.chip.sales'), money(r.daySales), 'good', 'sales'],
      [T.t('report.chip.refunds'), money(r.dayRefunds), '', 'refunds'],
      [T.t('report.chip.expenses'), money(r.dayExpenses), '', 'expenses'],
      [T.t('report.chip.buys'), money(r.dayBuys), '', 'buys'],
      [T.t('report.chip.low'), String(r.lowStock.length), r.lowStock.length ? 'bad' : 'good', 'low']
    ];
    $('reportChips').innerHTML = chips.map(function (c) {
      return '<button class="metric" data-action="metric-open" data-metric="' + c[3] + '">'
        + '<span class="lab">' + c[0] + '</span>'
        + '<span class="val ' + c[2] + '">' + c[1] + '</span></button>';
    }).join('');

    $('cashCheckExpected').textContent = T.t('report.expected') + money(r.cash);

    let ch = '';
    r.checks.slice().reverse().forEach(function (c) {
      ch += '<div class="entry"><span class="e-kind k-check">' + T.t('kind.check') + '</span>'
        + '<span class="growx">' + entryTime(c.at) + '</span>'
        + '<span class="' + (c.ok ? 'check-ok' : 'check-bad') + '">'
        + (c.ok ? T.t('report.matched') + ' ✓' : (T.t('report.diff') + (c.diff > 0 ? '+' : '') + f3(c.diff) + ' ' + T.t('curr'))) + '</span></div>';
    });
    $('checkHistory').innerHTML = ch || '<div class="empty">' + T.t('report.noChecks') + '</div>';

    let eh = '';
    r.entries.slice().reverse().forEach(function (e) {
      const cls = e.amount > 0 ? 'in' : (e.amount < 0 ? 'out' : 'none');
      const amt = e.amount === 0 ? '-' : n3(e.amount); // bare number — the shop floor reads the digits
      const guts = '<span class="e-kind k-' + e.kind + '">' + kindLabel(e.kind) + '</span>'
        + (e.no ? '<span class="e-no">#' + e.no + '</span>' : '')
        + (e.kind === 'refund' && e.saleNo ? '<span class="e-no">#' + e.saleNo + '</span>' : '')
        + '<span class="growx"><span class="e-time">' + entryTime(e.at) + '</span>'
        + (e.note ? '<span class="e-note">' + esc(e.note) + '</span>' : '') + '</span>'
        + '<span class="e-amt ' + cls + '">' + amt + '</span>';
      eh += e.kind === 'sale'
        ? '<button class="entry trow" data-action="ticket-open" data-id="' + e.id + '" data-i="' + e.no + '">'
          + guts + '</button>'
        : '<div class="entry">' + guts + '</div>';
    });
    $('entriesList').innerHTML = eh || '<div class="empty">' + T.t('report.noMoves') + '</div>';

    const byC = $('byCashier');
    if (byC) {
      const rows = r.byCashier || [];
      byC.innerHTML = rows.length
        ? rows.map(function (w) {
          return '<div class="byc"><span class="e-note">' + esc(w.who) + '</span>'
            + '<span class="growx">' + T.t('report.sales') + ' ' + w.count + '</span>'
            + '<b>' + money(w.total) + '</b></div>';
        }).join('')
        : '<div class="empty">' + T.t('report.noCashier') + '</div>';
      byC.classList.toggle('hidden', !rows.length);
    }

    const undoBtn = $('btnUndoSale');
    if (undoBtn) undoBtn.hidden = !!date || !D.canUndoSale(state);
  }

  // reopen a stored sale as a facture. legacy sales (no bill, pre-facture days)
  // still print — the total plus whatever the entry remembers.
  function openTicket(C, e, no) {
    const { $, showReceipt } = DEK.pages;
    C.receiptEntryId = e.id;
    const bill = e.bill;
    showReceipt(C, {
      customer: e.note || '', no: no,
      doc: e.doc || null,
      lines: bill && bill.lines ? bill.lines : [],
      discount: bill ? bill.discount : 0,
      net: bill ? bill.net : e.amount,
      paid: bill ? bill.paid : null,
      rest: bill ? bill.rest : 0,
      change: bill ? bill.change : 0,
      tax: bill ? bill.tax : null,
      when: e.at
    });
  }

  // ---------- the report metric boxes: tap one to see what the number MEANS ----------
  /* the day you are LOOKING at is the day the panel shows. It used to always
     read today's ledger, so browsing a closed day and tapping "sales" showed
     today's numbers under yesterday's report. */
  function openMetric(C, m) {
    const { state, $, T, D, fmt } = C;
    const { money, esc, kindLabel } = fmt;
    const date = (C.reportDate || '').trim();
    const browsing = !!date && date !== D.todayStr();
    const r = browsing ? (D.dayReportFor(state, date) || D.stats(state)) : D.stats(state);
    let title = '';
    let rows = '';
    const line = function (a, b, cls) {
      return '<div class="entry"><span class="growx">' + a + '</span><b class="e-amt ' + (cls || 'in') + '">' + b + '</b></div>';
    };
    if (m === 'low') {
      D.restockNeed(state).forEach(function (x) {
        rows += '<div class="entry"><span class="growx">' + esc(x.name)
          + ' <span class="e-note">' + T.t('report.left') + ' ' + money(x.stock)
          + ' · ' + T.t('stock.lowAt') + ' ' + money(x.lowAt) + '</span></span>'
          + '<button class="btn ghost" data-action="restock-need" data-id="' + x.id + '" data-qty="' + x.need + '">'
          + '+ ' + x.need + '</button></div>';
      });
      title = T.t('report.chip.low');
    } else if (m === 'inventory') {
      state.products.forEach(function (p) {
        rows += line(esc(p.name) + ' <span class="e-note">×' + p.stock + '</span>',
          money(p.stock * p.buy), p.stock <= p.lowAt ? 'bad' : 'in');
      });
      title = T.t('report.chip.inventory');
    } else if (m === 'debts') {
      state.debts.forEach(function (d) {
        rows += line(esc(d.name) + (d.note ? ' <span class="e-note">' + esc(d.note) + '</span>' : ''),
          money(d.total - d.paid), 'bad');
      });
      title = T.t('report.chip.debts');
    } else {
      const kind = { sales: 'sale', refunds: 'refund', expenses: 'expense', buys: 'buy' }[m];
      r.entries.forEach(function (e) {
        if (e.kind !== kind) return;
        rows += line(kindLabel(e.kind)
          + (e.no ? ' <span class="e-no">#' + e.no + '</span>' : '')
          + (e.kind === 'refund' && e.saleNo ? ' <span class="e-no">#' + e.saleNo + '</span>' : '')
          + (e.note ? ' <span class="e-note">' + esc(e.note) + '</span>' : ''),
          money(Math.abs(e.amount)), e.amount > 0 ? 'in' : 'bad');
      });
      title = T.t('report.chip.' + m);
    }
    $('metricBody').innerHTML = rows || '<div class="empty">' + T.t('report.noMoves') + '</div>';
    $('metricTitle').textContent = browsing ? (r.date + ' — ' + title) : title;
    $('metricPanel').classList.remove('hidden');
    if (document.body) document.body.classList.add('no-scroll');
  }

  // ---------- the STOCK CARD: one product's whole shelf story, newest movement last ----------
  // Reuses the metric panel (its close button / backdrop / Escape are already wired).
  /* M04: an adjustment says WHY — show the reason code beside the movement. */
  function openStockCard(C, productId) {
    const { state, $, T, D, fmt } = C;
    const { esc, entryTime } = fmt;
    const card = D.stockCard(state, productId);
    if (!card) return;
    const moveKey = {
      opening: 'stockCard.move.opening', sale: 'stockCard.move.sale', buy: 'stockCard.move.buy',
      refund: 'stockCard.move.refund', adjust: 'stockCard.move.adjust', undo: 'stockCard.move.undo'
    };
    const label = function (k) { return T.t(moveKey[k] || 'stockCard.move.adjust'); };
    const reasonText = function (m) { return m.reason ? T.t('stock.reason.' + m.reason) : ''; };
    let rows = '';
    card.moves.forEach(function (m) {
      const when = entryTime ? entryTime(m.at) : '';
      const why = reasonText(m);
      rows += '<div class="entry"><span class="growx">' + esc(label(m.kind))
        + (why ? ' <span class="e-note">· ' + esc(why) + '</span>' : '')
        + ' <span class="e-note">' + esc(when) + (m.note ? ' · ' + esc(m.note) : '') + '</span></span>'
        + '<b class="e-amt ' + (m.qty > 0 ? 'in' : 'bad') + '">' + (m.qty > 0 ? '+' : '') + m.qty
        + ' <span class="e-note">= ' + m.balance + '</span></b></div>';
    });
    rows += '<div class="entry"><span class="growx"><b>' + esc(T.t('stockCard.onHand')) + '</b></span>'
      + '<b class="e-amt in">' + card.balance + '</b></div>';
    $('metricBody').innerHTML = card.moves.length ? rows : '<div class="empty">' + esc(T.t('stockCard.empty')) + '</div>';
    $('metricTitle').textContent = card.product.name + ' — ' + T.t('stockCard.title');
    $('metricPanel').classList.remove('hidden');
    if (document.body) document.body.classList.add('no-scroll');
  }

  // ---------- the cash box: money in with a SOURCE, money out with a PURPOSE ----------
  function renderCashBox(C) {
    const { state, $, T, D, fmt } = C;
    const { money } = fmt;
    const P = DEK.pages;
    const r = D.stats(state);
    let inToday = 0, outToday = 0;
    state.day.entries.forEach(function (e) {
      if (e.kind === 'income') inToday += e.amount;
      if (e.kind === 'expense') outToday += -e.amount;
    });
    $('cbTill').innerHTML = '<div class="tilth">' + T.t('cashbox.now') + '</div>'
      + '<div class="tillnum">' + money(r.cash) + '</div>'
      + '<div class="tillsub">' + T.t('cashbox.inToday') + ' <b class="ok">' + money(inToday) + '</b>'
      + '  ·  ' + T.t('cashbox.outToday') + ' <b class="bad">' + money(outToday) + '</b></div>';
    $('cbInCat').innerHTML = P.catOptions(C, state.categories.in);
    $('cbOutCat').innerHTML = P.catOptions(C, state.categories.out);
    $('catInList').innerHTML = P.catChips(C, state.categories.in, 'in');
    $('catOutList').innerHTML = P.catChips(C, state.categories.out, 'out');
  }
  function catOptions(C, pool) {
    const { fmt } = C;
    const { esc } = fmt;
    return '<option value="">—</option>'
      + pool.map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>'; }).join('');
  }
  function catChips(C, pool, side) {
    const { T, fmt } = C;
    const { esc } = fmt;
    return pool.map(function (c) {
      return '<span class="chip">' + esc(c.name)
        + '<button class="chip-x" data-action="cat-del" data-id="' + c.id + '" data-i="' + side + '">×</button></span>';
    }).join('') || '<span class="muted">' + T.t('cashbox.noCats') + '</span>';
  }

  // ---------- the shop's OWN lists (wave 4): units, suppliers, refund reasons ----------
  /* one card, one row per list. The core is the gate: a list that breaks a rule
     (an empty unit list, a duplicate, an item too long) is refused BY NAME and the
     message under the row says which list and why — nothing is written. */
  function renderLists(C) {
    const { state, $, T, fmt } = C;
    const { esc } = fmt;
    const box = $('listGroups');
    if (!box) return;
    const lists = (state.custom && state.custom.lists) || {};
    const SPEC = [
      { name: 'units', key: 'lists.units' },
      { name: 'suppliers', key: 'lists.suppliers' },
      { name: 'refundReasons', key: 'lists.refundReasons' }
    ];
    box.innerHTML = SPEC.map(function (l) {
      const items = lists[l.name] || [];
      const chips = items.map(function (item) {
        return '<span class="chip">' + esc(item)
          + '<button class="chip-x" data-action="list-del" data-list="' + l.name + '" data-item="' + esc(item) + '">×</button></span>';
      }).join('') || '<span class="muted">' + T.t('lists.empty') + '</span>';
      return '<div class="listGroup">'
        + '<div class="listHead"><b>' + T.t(l.key) + '</b><span class="muted">' + items.length + '</span></div>'
        + '<div class="listChips">' + chips + '</div>'
        + '<div class="listRow"><input type="text" id="listInput-' + l.name + '">'
        + '<button type="button" class="btn ghost" data-action="list-add" data-list="' + l.name + '">' + T.t('lists.add') + '</button></div>'
        + '<p class="listMsg" id="listMsg-' + l.name + '"></p>'
        + '</div>';
    }).join('');
  }

  /* the shop's lists reach the forms that USE them: the product form's units
     (a real picker), and the supplier + refund-reason hints (native datalists,
     the same pattern as the customer/cashier names the app already offers). */
  function fillListHints(C) {
    const { state, $, fmt } = C;
    const { esc } = fmt;
    const lists = (state.custom && state.custom.lists) || {};
    const hint = function (id, items) {
      const el = $(id);
      if (!el) return;
      el.innerHTML = (items || []).map(function (v) {
        return '<option value="' + esc(v) + '"></option>';
      }).join('');
    };
    hint('supList', lists.suppliers);
    hint('refundReasonList', lists.refundReasons);
    if ($('pUnit')) $('pUnit').innerHTML = DEK.pages.unitOptions(C, $('pUnit').value);
  }

  // the product form's unit choices — the shop's list, with "" (no unit) first
  function unitOptions(C, selected) {    const { state, fmt } = C;
    const { esc } = fmt;
    const items = (state.custom && state.custom.lists && state.custom.lists.units) || [];
    return '<option value="">—</option>' + items.map(function (u) {
      return '<option value="' + esc(u) + '"' + (u === selected ? ' selected' : '') + '>' + esc(u) + '</option>';
    }).join('');
  }

  // the one line under a list row: what just happened, or the refusal BY NAME
  function listMsg(C, name, text, kind) {
    const el = C.$('listMsg-' + name);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'listMsg ' + (kind === 'ok' ? 'ok' : 'bad');
  }

  // ----- SETTINGS -----
  /* account row — the ONE place the account lives. It opens the form; it never
     ambushes the till. It also tells the truth about the cloud: signed out,
     synced, still waiting, offline, or "your session expired". */
  function renderSettings(C) {
    const { state, $, T, version } = C;
    const P = DEK.pages;
    $('cfgShopName').value = state.shop.name;
    $('cfgStartCash').value = state.day.startCash;
    $('cfgDiscount').checked = !!state.settings.allowDiscount;
    $('cfgRefund').checked = !!state.settings.allowRefund;
    P.renderThemes(C);
    P.renderLanguages(C);
    P.renderLists(C);
    if ($('appVersion')) $('appVersion').textContent = version;
    P.renderThemes(C);
    P.updateStorage(C);
    const has = C.D && C.D.hasPin ? C.D.hasPin(state) : false;
    const pinClear = $('btnPinClear');
    if (pinClear) pinClear.classList.toggle('hidden', !has);
    const pinStatus = $('pinStatus');
    if (pinStatus) {
      pinStatus.textContent = has
        ? T.t('settings.pinActive')
        : T.t('settings.pinOff');
      pinStatus.classList.toggle('pin-status-ok', has);
    }
    const acc = C.auth;
    const signed = !!(acc && acc.isLoggedIn());
    if ($('accountEmail')) $('accountEmail').textContent = signed && acc.getUser() ? acc.getUser().email : '—';
    if ($('accountMode')) $('accountMode').textContent = signed ? T.t('settings.accountSigned') : T.t('settings.accountLocal');
    if ($('btnSignOut')) $('btnSignOut').classList.toggle('hidden', !signed);
    if ($('btnAccountOpen')) {
      $('btnAccountOpen').textContent = signed ? T.t('auth.accountManage') : T.t('auth.accountOpen');
      $('btnAccountOpen').classList.toggle('hidden', false);
    }
    if ($('accountSync')) {
      let line;
      if (C.sync === 'expired') line = T.t('auth.expired');        // the token DIED — say that, not "signed out"
      else if (!signed) line = T.t('auth.syncNever');
      else if (C.sync === 'error') line = T.t('auth.syncFailed');
      else if (C.sync === 'local') line = T.t('auth.syncLocal');
      else if (C.syncAt) line = T.t('auth.syncAt').replace('{t}', entryTimeOf(C.syncAt));
      else line = T.t('auth.syncPending');
      $('accountSync').textContent = line;
      $('accountSync').className = 'b ' + (C.sync === 'ok' || C.sync === 'none' ? '' : 'bad');
    }
  }

  // "14:32" out of a millisecond stamp (the settings sync line)
  function entryTimeOf(ms) {
    try {
      const d = new Date(ms);
      const p = n => (n < 10 ? '0' : '') + n;
      return p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) { return ''; }
  }

  // ----- OWNER PIN: a keypad gate in front of the money actions -----
  function openPin(C, title) {
    const { $, T } = C;
    C.pinBuf = '';
    C.pinTitle = title || T.t('pin.title');
    renderPin(C);
    $('pinPanel').classList.remove('hidden');
    if (document.body) document.body.classList.add('no-scroll');
  }
  function closePin(C) {
    const { $ } = C;
    C.pinBuf = '';
    C.pinPending = null;
    $('pinPanel').classList.add('hidden');
    if (document.body) document.body.classList.remove('no-scroll');
  }
  function renderPin(C) {
    const { $, T } = C;
    if (!$('pinPanel')) return;
    $('pinTitle').textContent = C.pinTitle || T.t('pin.title');
    const dots = '●●●●●●'.slice(0, (C.pinBuf || '').length);
    $('pinDots').textContent = dots || '';
    $('pinError').classList.add('hidden');
    const ok = $('keyOk');
    if (ok) ok.disabled = (C.pinBuf || '').length < 4;
  }
  function pinKey(C, key) {
    if (key === 'clear') { C.pinBuf = ''; renderPin(C); return; }
    if (key === 'ok') {
      if ((C.pinBuf || '').length < 4) return;
      if (!C.D.checkPin(C.state, C.pinBuf)) {
        C.pinBuf = '';
        renderPin(C); // clears dots + hides the error
        C.$('pinError').textContent = C.T.t('pin.wrong'); // …then the error shows
        C.$('pinError').classList.remove('hidden');
        const el = C.$('pinDots');
        if (el && el.classList) {
          el.classList.add('shake');
          setTimeout(function () { el.classList.remove('shake'); }, 400);
        }
        return;
      }
      const pending = C.pinPending;
      closePin(C);
      if (pending) pending();
      return;
    }
    if (!/^\d$/.test(String(key))) return;
    if ((C.pinBuf || '').length >= 6) return;
    C.pinBuf += key;
    renderPin(C);
  }

  // ----- DOCUMENTS (wave 3): the shop's own paper -----
  // One table drives the whole screen. `max` documents the core's own limit: the
  // fields accept what a shopkeeper types and the core is the authority that
  // refuses an illegal value BY NAME (`setCustom`), so the reason always shows.
  const DOC_FIELDS = [
    { g: 'doc.grp.brand', k: 'brand.tagline', kind: 'text', max: 120, rowKey: 'doc.f.tagline' },
    { g: 'doc.grp.brand', k: 'brand.address', kind: 'text', max: 200, rowKey: 'doc.f.address' },
    { g: 'doc.grp.brand', k: 'brand.phone', kind: 'text', max: 120, rowKey: 'doc.f.phone' },
    { g: 'doc.grp.brand', k: 'brand.taxId', kind: 'text', max: 120, rowKey: 'doc.f.taxId' },
    { g: 'doc.grp.brand', k: 'brand.logoUrl', kind: 'text', max: 500, ltr: true, rowKey: 'doc.f.logo' },
    { g: 'doc.grp.money', k: 'money.symbol', kind: 'text', max: 6, ltr: true, rowKey: 'doc.f.symbol' },
    { g: 'doc.grp.money', k: 'money.position', kind: 'select', opts: ['after', 'before'], rowKey: 'doc.f.position', optLabel: { after: 'doc.pos.after', before: 'doc.pos.before' } },
    { g: 'doc.grp.money', k: 'money.decimals', kind: 'select', opts: ['0', '1', '2', '3'], num: true, rowKey: 'doc.f.decimals' },
    { g: 'doc.grp.money', k: 'money.thousands', kind: 'select', opts: ['', ' ', ',', '.'], rowKey: 'doc.f.thousands', optLabel: { '': 'doc.thou.none', ' ': 'doc.thou.space', ',': 'doc.thou.comma', '.': 'doc.thou.dot' } },
    { g: 'doc.grp.money', k: 'money.digits', kind: 'select', opts: ['latin', 'arabic'], rowKey: 'doc.f.digits', optLabel: { latin: 'doc.dig.latin', arabic: 'doc.dig.arabic' } },
    { g: 'doc.grp.date', k: 'date.format', kind: 'select', opts: ['YYYY-MM-DD', 'YYYY/MM/DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY'], rowKey: 'doc.f.dateFormat' },
    { g: 'doc.grp.date', k: 'date.time', kind: 'select', opts: ['24h', '12h'], rowKey: 'doc.f.time' },
    { g: 'doc.grp.print', k: 'print.size', kind: 'select', opts: ['58mm', '80mm', 'A4'], rowKey: 'doc.f.paper' },
    { g: 'doc.grp.print', k: 'print.copies', kind: 'select', opts: ['1', '2', '3'], num: true, rowKey: 'doc.f.copies' },
    { g: 'doc.grp.print', k: 'print.autoPrint', kind: 'switch', rowKey: 'doc.f.autoPrint' },
    { g: 'doc.grp.receipt', k: 'receipt.header', kind: 'text', max: 120, rowKey: 'doc.f.header' },
    { g: 'doc.grp.receipt', k: 'receipt.footer', kind: 'text', max: 120, rowKey: 'doc.f.footer' },
    { g: 'doc.grp.receipt', k: 'receipt.showTaxId', kind: 'switch', rowKey: 'doc.f.showTaxId' },
    { g: 'doc.grp.lang', k: 'docLanguage', kind: 'select', langAny: true, rowKey: 'doc.f.docLang' }
  ];

  function docValue(custom, key) {
    const parts = key.split('.');
    if (parts.length === 1) return custom[key];
    return (custom[parts[0]] || {})[parts[1]];
  }

  // the fields, grouped; a switch is a switch because a shopkeeper sees a switch
  function renderDocEditor(C) {
    const { $, T, fmt } = C;
    const { esc } = fmt;
    const box = $('docGroups');
    if (!box || !C.docDraft) return;
    const groups = [];
    DOC_FIELDS.forEach(function (f) {
      if (!groups.length || groups[groups.length - 1].g !== f.g) groups.push({ g: f.g, fields: [] });
      groups[groups.length - 1].fields.push(f);
    });
    box.innerHTML = groups.map(function (grp) {
      return '<div class="themeGrp"><b>' + T.t(grp.g) + '</b>' + grp.fields.map(function (f) {
        const v = docValue(C.docDraft, f.k);
        const lab = T.t(f.rowKey);
        let ctl;
        if (f.kind === 'switch') {
          ctl = '<label class="switch"><input type="checkbox" data-doc="' + f.k + '"' + (v ? ' checked' : '') + '><span></span></label>';
        } else if (f.kind === 'select') {
          let opts = f.opts;
          if (f.langAny) {
            opts = [''].concat((window.DEK.Langs ? window.DEK.Langs.list() : []).map(function (l) {
              return typeof l === 'string' ? l : l.id;
            }));
          }
          ctl = '<select data-doc="' + f.k + '">' + opts.map(function (o) {
            const shown = f.langAny
              ? (o === '' ? T.t('doc.docLang.follow') : o.toUpperCase())
              : (f.optLabel && f.optLabel[o] ? T.t(f.optLabel[o]) : o);
            return '<option value="' + esc(o) + '"' + (String(v) === String(o) ? ' selected' : '') + '>' + esc(shown) + '</option>';
          }).join('') + '</select>';
        } else {
          ctl = '<input type="text" data-doc="' + f.k + '" value="' + esc(v == null ? '' : v) + '" spellcheck="false"'
            + (f.ltr ? ' dir="ltr"' : '') + '>';
        }
        return '<span class="themeRow docRow' + (f.kind === 'switch' ? ' docSwitch' : '') + '">'
          + ctl
          + '<code class="themeTok docKey">' + esc(lab) + '</code></span>';
      }).join('') + '</div>';
    }).join('');
    T.apply();
  }

  // The sample: a shopkeeper does not read "decimals: 2", he reads the number.
  // It is the ONE thing that makes a format screen trustworthy.
  function renderDocSample(C) {
    const { $, T, fmt } = C;
    const el = $('docSample');
    if (!el) return;
    el.textContent = T.t('doc.sample') + ':  ' + fmt.money(1500.5) + '  ·  ' + fmt.docDate(new Date().toISOString().slice(0, 10));
  }

  function docMsg(C, text, kind) {
    const el = C.$('docMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'themeMsg' + (kind ? ' ' + kind : '');
  }

  // ----- the printed PAPER SIZE -----
  // @page cannot be scoped by a class, so the size goes into a stylesheet the app
  // rewrites. A roll gets TWO EXPLICIT LENGTHS: `size:80mm auto` is not valid CSS
  // (`size` is `auto | <length>{1,2} | <page-size>`), and Chromium drops the whole
  // rule — the ticket then printed on the default sheet (US Letter), which is
  // exactly the bug the shop reported. `auto` also is not what a roll needs: the
  // sheet must be the height the ticket actually uses, so the ticket is laid out
  // at its print width first, measured, and that height goes on the paper.
  const PAPER = {
    '58mm': { w: 58, margin: 2, width: 54, name: '58mm', unmeasuredH: 297 },
    '80mm': { w: 80, margin: 3, width: 74, name: '80mm', unmeasuredH: 297 },
    'A4': { w: 210, margin: 12, width: 190, name: 'A4', unmeasuredH: 0 }
  };
  const PAPER_MIN_MM = 40;    // under this a ticket is a stamp, and a print head jams
  const PAPER_MAX_MM = 999;   // over this it is a typo, not a ticket

  function paperOf(choice) { return PAPER[choice] || PAPER['80mm']; }

  // A missing measurement ("the ticket is not on screen") is NOT the same as a
  // measured zero: one wants a whole roll's worth of sheet, the other is a slip.
  function paperCss(choice, contentMM) {
    const p = paperOf(choice);
    if (p.name === 'A4') return '@page{size:A4;margin:' + p.margin + 'mm}\n'
      + '@media print{.receipt-card{width:' + p.width + 'mm!important;max-width:' + p.width + 'mm!important;margin:0!important;}}';
    const n = Number(contentMM);
    const measured = (contentMM === null || contentMM === undefined || !isFinite(n)) ? null : Math.max(0, n);
    const h = measured === null
      ? p.unmeasuredH
      : Math.min(PAPER_MAX_MM, Math.max(PAPER_MIN_MM, Math.round(measured + 2 * p.margin + 1)));
    return '@page{size:' + p.w + 'mm ' + h + 'mm;margin:' + p.margin + 'mm}\n'
      + '@media print{.receipt-card{width:' + p.width + 'mm!important;max-width:' + p.width + 'mm!important;margin:0!important;}}';
  }

  function paperStyleEl() {
    let st = document.getElementById('paperStyle');
    if (!st) {
      st = document.createElement('style');
      st.id = 'paperStyle';
      if (document.head) document.head.appendChild(st);
    }
    return st;
  }

  // how tall the ticket really is at the width it will be printed at. The screen's
  // width is not the paper's, so the card is measured AFTER being put at the print
  // width (CSS px are exactly 1/96in, so px -> mm is exact, not a guess).
  function receiptHeightMM(p) {
    if (!document.querySelector) return null;
    const card = document.querySelector('#receipt .receipt-card');
    if (!card || !card.getBoundingClientRect || !card.style) return null;
    const was = { width: card.style.width, max: card.style.maxWidth, box: card.style.boxSizing, maxH: card.style.maxHeight, overflow: card.style.overflow };
    card.style.boxSizing = 'border-box';
    card.style.width = p.width + 'mm';
    card.style.maxWidth = p.width + 'mm';
    card.style.maxHeight = 'none';     // the SCREEN caps the card's height; the PAPER does not
    card.style.overflow = 'visible';
    const px = card.getBoundingClientRect().height;
    card.style.width = was.width;
    card.style.maxWidth = was.max;
    card.style.boxSizing = was.box;
    card.style.maxHeight = was.maxH;
    card.style.overflow = was.overflow;
    if (!(px > 0)) return null;                        // hidden or empty: not a measurement
    return Math.ceil((px * 25.4) / 96);
  }

  function applyPaper(C) {
    const choice = (C.state.custom && C.state.custom.print && C.state.custom.print.size) || '80mm';
    const p = paperOf(choice);
    paperStyleEl().textContent = paperCss(choice, p.name === 'A4' ? 0 : receiptHeightMM(p));
  }

  // ----- the shop's own NAME, in the app's own style -----
  function shopTitle(state, fallback) {
    const name = String((state && state.shop && state.shop.name) || '').trim();
    return name || String(fallback == null ? '' : fallback);
  }
  function shopInitial(state, fallback) {
    const name = String((state && state.shop && state.shop.name) || '').trim();
    return name.charAt(0) || String(fallback == null ? '' : fallback).charAt(0);
  }
  function shopTagline(state, fallback) {
    const b = state && state.custom && state.custom.brand;
    const tag = String((b && b.tagline) || '').trim();
    return tag || String(fallback == null ? '' : fallback);
  }

  function printTicket(C) {
    if (!window.print) return;
    applyPaper(C);
    const copies = (C.state.custom && C.state.custom.print && C.state.custom.print.copies) || 1;
    for (let i = 0; i < copies; i++) window.print();
  }

  // ----- THEMES (colors live in ui/themes.js — the app just asks) -----
  function themes() { return window.DEK && window.DEK.Themes; }

  function renderThemes(C) {
    const { $, T } = C;
    const TH = themes();
    if (!TH || !$('themeGrid')) return;
    const cur = TH.current().id;
    $('themeGrid').innerHTML = TH.all().map(function (th) {
      return '<button type="button" class="theme-sw' + (th.id === cur ? ' active' : '') + '" data-theme="' + th.id + '">'
        + '<span class="dots">' + th.preview.map(function (c) {
          return '<i style="background:' + c + '"></i>';
        }).join('') + '</span>'
        + '<b>' + T.t(th.nameKey)
        + (th.id === cur && TH.isCustomized() ? '<span class="themeBadge">' + T.t('theme.customized') + '</span>' : '')
        + '</b></button>';
    }).join('');
  }

  // ----- THE COLOUR EDITOR (wave 2) -----
  // The SAME 42 tokens the app already paints, grouped the way a shopkeeper
  // thinks about them. Each row is a text field (the truth: it can hold rgba()
  // or a whole shadow) + a picker that drives it when the value is a plain hex.
  // The list is DATA: a group here, a token there, and the screen follows.
  const THEME_GROUPS = [
    { key: 'theme.grp.bg', toks: ['--bg', '--bg2', '--glowa', '--glowb'] },
    { key: 'theme.grp.surface', toks: ['--panel', '--panel2', '--panel3'] },
    { key: 'theme.grp.line', toks: ['--line', '--line2'] },
    { key: 'theme.grp.text', toks: ['--txt', '--mut', '--dim', '--ink'] },
    { key: 'theme.grp.acc', toks: ['--acc', '--acc2', '--accdark', '--accbg', '--accborder', '--accover', '--accglow'] },
    { key: 'theme.grp.status', toks: ['--ok', '--okbg', '--okhi', '--danger', '--dangerbg', '--dangerhi'] },
    { key: 'theme.grp.coin', toks: ['--coin1', '--coin2', '--coin3', '--coinedge', '--coinring', '--coinshadow'] },
    { key: 'theme.grp.ctrl', toks: ['--pri1', '--pri2', '--priedge', '--inbg', '--inbgfocus', '--switchknob', '--switchfill', '--scrail', '--scrthumb', '--shadow'] }
  ];

  // "#abc" -> "#aabbcc"; anything a colour picker cannot hold -> null (the picker
  // is then disabled and the text field is the only way in — on purpose)
  function hex6(v) {
    const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(v == null ? '' : v).trim());
    if (!m) return null;
    let d = m[1];
    if (d.length === 3) d = d.charAt(0) + d.charAt(0) + d.charAt(1) + d.charAt(1) + d.charAt(2) + d.charAt(2);
    return '#' + d.toLowerCase();
  }

  function renderThemeEditor(C) {
    const { $, T, fmt } = C;
    const { esc } = fmt;
    const TH = themes();
    const box = $('themeGroups');
    if (!TH || !box || !C.themeDraft) return;
    const toks = C.themeDraft.tokens || {};
    const base = $('themeBase');
    if (base) {
      base.innerHTML = TH.all().map(function (th) {
        return '<button type="button" class="segbtn' + (th.id === C.themeDraft.id ? ' active' : '') + '"'
          + ' data-base="' + th.id + '">' + T.t(th.nameKey) + '</button>';
      }).join('');
    }
    box.innerHTML = THEME_GROUPS.map(function (g) {
      return '<div class="themeGrp"><b>' + T.t(g.key) + '</b>'
        + g.toks.map(function (tok) {
          const v = toks[tok] === undefined ? '' : toks[tok];
          const c = hex6(v);
          return '<span class="themeRow">'
            + '<input type="color" data-pick="' + tok + '" value="' + (c || '#000000') + '"' + (c ? '' : ' disabled') + '>'
            + '<input type="text" data-tok="' + tok + '" value="' + esc(v) + '" spellcheck="false" dir="ltr">'
            + '<code class="themeTok">' + tok + '</code></span>';
        }).join('') + '</div>';
    }).join('');
    T.apply(); // the group labels are [data-i18n], generated just now
  }

  // the little line under the JSON box: a refusal is shown, never swallowed
  function themeMsg(C, text, kind) {
    const el = C.$('themeMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'themeMsg' + (kind ? ' ' + kind : '');
  }

  // ----- LANGUAGES (text lives in ui/lang.ts, the registry in ui/langs.ts) -----
  // One button per language OBJECT: adding a language shows up here with no edit.
  // Ids stay `lang<Id>` (`ar` -> #langAr) so the e2e selectors keep holding.
  function languages() { return window.DEK && window.DEK.Langs; }

  function renderLanguages(C) {
    const { $, T } = C;
    const LG = languages();
    const seg = $('langSeg');
    if (!LG || !seg) return;
    seg.innerHTML = LG.all().map(function (l) {
      const id = 'lang' + l.id.charAt(0).toUpperCase() + l.id.slice(1);
      return '<button type="button" class="segbtn' + (l.id === T.lang ? ' active' : '') + '"'
        + ' id="' + id + '" data-lang="' + l.id + '" lang="' + l.id + '"'
        + ' dir="' + l.dir + '">' + l.native + '</button>';
    }).join('');
  }

  function updateStorage(C) {
    const { $, storageRead } = C;
    const el = $('storageUsed');
    if (!el || storageRead) return;
    if (!(navigator.storage && navigator.storage.estimate)) return;
    C.storageRead = true;
    navigator.storage.estimate().then(function (est) {
      const mb = (est.usage || 0) / 1048576;
      el.textContent = (mb < 0.1 ? '<0.1' : (mb < 10 ? mb.toFixed(1) : String(Math.round(mb)))) + ' MB';
    }).catch(function () { /* stays — */ });
  }

  // ----- the till: one checkout = one client = one receipt -----
  // The ticket is the shop's PAPER (wave 3): its brand, its wording, its date
  // format, and — when it asks — a language other than the screen's.
  /* a fresh receipt starts with no refund reason typed and the row tucked away */
  function showReceipt(C, r) {
    const { state, $, fmt } = C;
    const { money, esc, entryTime, docT, docDate } = fmt;
    const cb = state.custom || {};
    const brand = cb.brand || {};
    const receiptCfg = cb.receipt || {};
    const rec = $('receipt');
    const when = r.when || new Date().toISOString();
    $('rShop').textContent = state.shop.name;
    $('rWhen').textContent = docDate(when) + ' ' + entryTime(when);
    const line = function (id, text) {
      const el = $(id);
      if (!el) return;
      el.textContent = text || '';
      el.classList.toggle('hidden', !text);
    };
    line('rTagline', brand.tagline);
    line('rAddr', brand.address);
    line('rPhone', brand.phone);
    line('rTax', receiptCfg.showTaxId ? brand.taxId : '');
    const logo = $('rLogo');
    if (logo) {
      const url = String(brand.logoUrl || '').trim();
      if (/^(https?:|data:image\/)/.test(url)) {
        logo.innerHTML = '<img src="' + esc(url) + '" alt="">';
      } else {
        logo.textContent = (brand.logoUrl || state.shop.name || 'د').trim().charAt(0) || 'د';
      }
    }
    line('rHeadText', receiptCfg.header);
    const footEl = $('rFootText');
    if (footEl) footEl.textContent = receiptCfg.footer || docT('receipt.thanks');
    const card = rec.querySelector ? rec.querySelector('.receipt-card') : null;
    if (card && card.setAttribute) {
      const lang = (cb.docLanguage || '');
      if (lang) { card.setAttribute('lang', lang); card.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr'); }
      else { card.removeAttribute('lang'); card.removeAttribute('dir'); }
    }
    $('rClient').textContent = r.customer ? esc(r.customer) + ' #' + r.no : '#' + r.no;
    if (r.doc && r.doc.no) {
      $('rDoc').textContent = r.doc.no;
      $('rDoc').classList.remove('hidden');
    } else {
      $('rDoc').classList.add('hidden');
    }
    $('rLines').innerHTML = r.lines.map(function (l) {
      return '<div class="r-line"><span>' + esc(l.name) + ' <span class="r-q">×' + l.qty + (l.unit ? ' ' + esc(l.unit) : '')
        + ' @ ' + money(l.price) + '</span></span><b>' + money(l.total) + '</b></div>';
    }).join('') || '<div class="empty">—</div>';

    let t = '<div class="r-row big"><span>' + docT('receipt.total') + '</span><b>' + money(r.net) + '</b></div>';
    if (r.discount > 0) t += '<div class="r-row dim"><span>' + docT('sell.discount') + '</span><span>−' + money(r.discount) + '</span></div>';
    if (r.tax && r.tax.code) {
      t += '<div class="r-row dim"><span>' + esc(r.tax.code) + ' ' + Math.round(r.tax.rate * 100) + '%</span><b>' + money(r.net * r.tax.rate) + '</b></div>';
    }
    if (r.paid !== null) {
      t += '<div class="r-row"><span>' + docT('receipt.paid') + '</span><b>' + money(r.paid) + '</b></div>';
      if (r.change > 0) t += '<div class="r-row ok"><span>' + docT('sell.change') + '</span><b>' + money(r.change) + '</b></div>';
      else if (r.rest > 0) t += '<div class="r-row bad"><span>' + docT('sell.rest') + '</span><b>' + money(r.rest) + '</b></div>';
    } else if (r.rest > 0) {
      t += '<div class="r-row bad"><span>' + docT('sell.rest') + '</span><b>' + money(r.rest) + '</b></div>';
    }
    $('rTotals').innerHTML = t;
    if ($('receiptRefundReason')) $('receiptRefundReason').value = '';
    if ($('receiptRefundRow')) $('receiptRefundRow').classList.add('hidden');
    if ($('btnReceiptRefund')) {
      $('btnReceiptRefund').classList.toggle('hidden', state.settings.allowRefund === false);
    }
    rec.classList.remove('hidden');
    if (document.body) document.body.classList.add('no-scroll');
  }
  function hideReceipt(C) {
    const { $ } = C;
    $('receipt').classList.add('hidden');
    if (document.body) document.body.classList.remove('no-scroll');
  }

  // ----- STAFF (the team: hire / edit / fire) -----
  /* the hire/edit form only exists when it is in flight (C.editEmployeeId) */
  function renderEmployees(C) {
    const { state, $, T, fmt } = C;
    const { money, esc } = fmt;
    const team = state.employees || [];
    if (!team.length) {
      $('staffList').innerHTML = '<p class="muted">' + T.t('staff.empty') + '</p>';
    } else {
      $('staffList').innerHTML = team.map(function (e) {
        const meta = [e.type, T.t('staff.hired') + ': ' + e.hiredAt, e.phone, e.note].filter(Boolean).join(' · ');
        const fired = e.active ? '' : ' <span class="muted">(' + T.t('staff.fired') + ')</span>';
        return '<div class="entry">' +
          '<div class="stack" style="flex:1">' +
          '<b>' + esc(e.name) + fired + '</b>' +
          '<small class="muted">' + esc(meta) + '</small>' +
          '<small class="muted">' + money(e.salary) + ' / ' + T.t('staff.perMonth') + '</small>' +
          '</div>' +
          '<span class="row gr">' +
          '<button class="btn ghost" data-action="staff-edit" data-id="' + e.id + '">' + T.t('staff.edit') + '</button>' +
          (e.active ? '<button class="btn ghost" data-action="staff-fire" data-id="' + e.id + '">' + T.t('staff.fire') + '</button>' : '') +
          '</span></div>';
      }).join('');
    }

    const form = $('staffForm');
    if (C.editEmployeeId) {
      form.classList.remove('hidden');
      if (C.editEmployeeId !== 'new') {
        const e = team.find(function (x) { return x.id === C.editEmployeeId; });
        if (e) {
          $('staffFormTitle').textContent = T.t('staff.edit') + ': ' + e.name;
          $('empName').value = e.name;
          $('empType').value = e.type;
          $('empSalary').value = String(e.salary);
          $('empPhone').value = e.phone;
          $('empNote').value = e.note;
        }
      }
    } else {
      form.classList.add('hidden');
    }
  }

  // ----- MONTHLY REVIEW (one month, wins/losses/profit with salaries) -----
  function currentMonth() {
    const n = new Date();
    return n.getFullYear() + '-' + ((n.getMonth() + 1) < 10 ? '0' : '') + (n.getMonth() + 1);
  }
  function renderMonthly(C) {
    const { state, $, T, D, fmt } = C;
    const { money } = fmt;
    const ym = C.month && /^\d{4}-\d{2}$/.test(C.month) ? C.month : (C.month = currentMonth());
    const r = D.monthlyReport(state, ym);

    $('monthPicker').value = ym;
    $('monthWins').textContent = money(r.wins);
    $('monthLosses').textContent = money(r.losses);
    const profit = $('monthProfit');
    profit.textContent = money(r.profit);
    profit.classList.toggle('ok', r.profit >= 0);
    profit.classList.toggle('bad', r.profit < 0);

    const line = function (lab, val, cls) {
      return '<div class="mrow"><span class="lab">' + lab + '</span><b class="' + (cls || '') + '">' + money(val) + '</b></div>';
    };
    $('monthBreakdown').innerHTML =
      line(T.t('staff.sales'), r.sales) +
      line(T.t('staff.debtPays'), r.debtPays) +
      line(T.t('staff.incomes'), r.incomes) +
      line(T.t('staff.refunds'), r.refunds) +
      line(T.t('staff.buys'), r.buys) +
      line(T.t('staff.expenses'), r.expenses) +
      line(T.t('staff.salaries'), r.salaries, 'bad');

    const dayRows = r.days.map(function (d) {
      return '<div class="mrow"><span class="lab">' + d.date + '</span>' +
        '<b class="ok">+' + money(d.in) + '</b>' +
        '<b class="bad">-' + money(d.out) + '</b></div>';
    }).join('');
    $('monthDays').innerHTML = dayRows
      ? '<div class="mrow"><span class="lab">' + T.t('staff.dayInOut') + '</span>' +
        '<b>' + T.t('staff.moves') + ': ' + r.moves + '</b></div>' + dayRows
      : '';
  }

  function revealProductForm(C) {
    const { $ } = C;
    const f = $('productForm');
    if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  DEK.pages = {
    render: render, renderHeader: renderHeader, renderSell: renderSell, quote: quote,
    renderFreePrev: renderFreePrev, renderChange: renderChange, addToBasket: addToBasket,
    renderStock: renderStock, renderDebts: renderDebts, renderClients: renderClients, setNewDebt: setNewDebt,
    renderReport: renderReport, openTicket: openTicket, openMetric: openMetric, openStockCard: openStockCard,
    renderCashBox: renderCashBox, catOptions: catOptions, catChips: catChips,
  renderLists: renderLists, unitOptions: unitOptions, listMsg: listMsg, fillListHints: fillListHints,
    renderSettings: renderSettings, renderThemes: renderThemes, renderLanguages: renderLanguages, updateStorage: updateStorage,
    renderThemeEditor: renderThemeEditor, themeMsg: themeMsg, hex6: hex6, THEME_GROUPS: THEME_GROUPS,
    renderDocEditor: renderDocEditor, renderDocSample: renderDocSample, docMsg: docMsg, DOC_FIELDS: DOC_FIELDS,
    applyPaper: applyPaper, printTicket: printTicket, paperCss: paperCss,
    shopTitle: shopTitle, shopInitial: shopInitial, shopTagline: shopTagline,
    showReceipt: showReceipt, hideReceipt: hideReceipt, revealProductForm: revealProductForm,
    renderEmployees: renderEmployees, renderMonthly: renderMonthly,
    openPin: openPin, closePin: closePin, pinKey: pinKey
  };
});
