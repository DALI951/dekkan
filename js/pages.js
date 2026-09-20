/* DEKKAN UI — pages: every renderer and modal lightbox, one per page.
 * Split mechanically from js/app.js — bodies untouched, only each function's
 * signature changed to (C) with its ctx needs destructured on the first line.
 * C = window.DEK.app (created by js/app.js): { state, basket, freeItems,
 * refundMode, refundProductId, editProductId, payDebtId, newDebtFlag,
 * receiptEntryId, storageRead, $, T, D, version, save, run, render, toast }.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK) factory(root.DEK);
})(typeof self !== 'undefined' ? self : this, function (DEK) {
  'use strict';

  function render(C) {
    const { renderHeader, renderSell, renderStock, renderDebts, renderReport, renderCashBox, renderSettings, renderEmployees, renderMonthly } = DEK.pages;
    renderHeader(C);
    renderSell(C);
    renderStock(C);
    renderDebts(C);
    renderReport(C);
    renderCashBox(C);
    renderSettings(C);
    renderEmployees(C);
    renderMonthly(C);
  }

  function renderHeader(C) {
    const { state, $, T, D, fmt } = C;
    const { money } = fmt;
    $('shopName').textContent = state.shop.name;
    const cash = money(D.cash(state));
    $('cashNow').textContent = cash;
    if ($('cashNow2')) $('cashNow2').textContent = cash;
    $('todayLine').textContent = T.t('today') + D.todayStr();
  }

  // ----- SELL -----
  function renderSell(C) {
    const { state, basket, freeItems, refundMode, refundProductId, $, T, D, fmt } = C;
    const { money, n3, esc, stockLeft } = fmt;
    const P = DEK.pages;
    $('btnRefundMode').classList.toggle('on', refundMode);
    $('refundPanel').classList.toggle('hidden', !refundMode);

    let html = '';
    state.products.forEach(function (p) {
      const low = p.lowAt > 0 && p.stock <= p.lowAt;
      const out = p.stock <= 0;
      html += '<button class="sell-tile' + (out ? ' out' : '') + '" data-id="' + p.id + '"' + (out ? ' disabled' : '') + ' data-action="sell-add">'
        + '<span class="t-name">' + esc(p.name) + '</span>'
        + '<span class="t-price">' + money(p.sell) + '</span>'
        + '<span class="t-stock' + (low ? ' low' : '') + '">' + stockLeft(p.stock) + '</span>'
        + '</button>';
    });
    $('sellGrid').innerHTML = html || '<div class="empty">' + T.t('sell.none') + '</div>';

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

    const subtotal = basket.reduce(function (a, b) {
      const p = D.getProduct(state, b.id);
      return a + (p ? p.sell * b.qty : 0);
    }, 0) + freeItems.reduce(function (a, f) { return a + f.price * f.qty; }, 0);

    const pct = parseFloat($('discPct').value) || 0;
    const amt = parseFloat($('discAmt').value) || 0;
    const disc = amt > 0 ? Math.min(amt, subtotal) : Math.min(subtotal * pct / 100, subtotal);
    $('discountRow').classList.toggle('hidden', !state.settings.allowDiscount);
    const net = n3(Math.max(0, subtotal - disc));
    $('basketTotal').textContent = money(net);

    // what the customer must hand over — right there, and it moves while you type
    const parts = [];
    if (count > 0) parts.push(count + ' ' + T.t('sell.items'));
    if (disc > 0) parts.push(T.t('sell.discount') + ' ' + money(disc));
    $('dueBox').classList.toggle('empty', net <= 0);
    $('dueHint').textContent = net > 0 ? parts.join('  ·  ') : T.t('sell.nothingYet');

    // the queue: which # the next customer takes (the # on their receipt)
    $('queueLine').textContent = T.t('sell.nextClient') + ' #' + D.nextClientNo(state);

    // the counter's memory: names you can pick while typing
    $('customerList').innerHTML = D.customerNames(state).map(function (n) {
      return '<option value="' + esc(n) + '"></option>';
    }).join('');

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
        + '<span class="s-meta">' + T.t('stock.buy') + ' ' + money(p.buy) + '  •  ' + T.t('stock.sell') + ' ' + money(p.sell) + '</span></span>'
        + '<span class="row gap"><span class="s-stock' + (low ? ' low' : '') + '">' + p.stock + '</span>'
        + '<button class="btn ghost" data-action="stock-edit" data-id="' + p.id + '">' + T.t('stock.edit') + '</button>'
        + '<button class="btn ghost" data-action="stock-restock" data-id="' + p.id + '">+10</button></span></div>';
    });
    $('stockList').innerHTML = html || '<div class="empty">' + T.t('stock.empty') + '</div>';
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

  // ----- REPORT -----
  function renderReport(C) {
    const { state, $, T, D, fmt } = C;
    const { money, n3, fmt: f3, esc, entryTime, kindLabel } = fmt;
    const r = D.stats(state);

    // the till: one big number, read from across the shop
    $('tillCard').innerHTML =
      '<div class="tilth">' + T.t('report.chip.now') + '</div>'
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
      // a sale row IS a ticket: tap it to reopen the facture
      eh += e.kind === 'sale'
        ? '<button class="entry trow" data-action="ticket-open" data-id="' + e.id + '" data-i="' + e.no + '">'
          + guts + '</button>'
        : '<div class="entry">' + guts + '</div>';
    });
    $('entriesList').innerHTML = eh || '<div class="empty">' + T.t('report.noMoves') + '</div>';
  }

  // reopen a stored sale as a facture. legacy sales (no bill, pre-facture days)
  // still print — the total plus whatever the entry remembers.
  function openTicket(C, e, no) {
    const { $, showReceipt } = DEK.pages;
    C.receiptEntryId = e.id;
    const bill = e.bill;
    showReceipt(C, {
      customer: e.note || '', no: no,
      lines: bill && bill.lines ? bill.lines : [],
      discount: bill ? bill.discount : 0,
      net: bill ? bill.net : e.amount,
      paid: bill ? bill.paid : null,
      rest: bill ? bill.rest : 0,
      change: bill ? bill.change : 0,
      when: e.at
    });
  }

  // ---------- the report metric boxes: tap one to see what the number MEANS ----------
  function openMetric(C, m) {
    const { state, $, T, D, fmt } = C;
    const { money, esc, kindLabel } = fmt;
    const r = D.stats(state);
    let rows = '';
    const line = function (a, b, cls) {
      return '<div class="entry"><span class="growx">' + a + '</span><b class="e-amt ' + (cls || 'in') + '">' + b + '</b></div>';
    };
    if (m === 'low') {
      r.lowStock.forEach(function (p) {
        rows += line(esc(p.name) + ' <span class="e-note">' + T.t('stock.lowAt') + ' ' + money(p.lowAt) + '</span>',
          money(p.stock), 'bad');
      });
      $('metricTitle').textContent = T.t('report.chip.low');
    } else if (m === 'inventory') {
      state.products.forEach(function (p) {
        rows += line(esc(p.name) + ' <span class="e-note">×' + p.stock + '</span>',
          money(p.stock * p.buy), p.stock <= p.lowAt ? 'bad' : 'in');
      });
      $('metricTitle').textContent = T.t('report.chip.inventory');
    } else if (m === 'debts') {
      state.debts.forEach(function (d) {
        rows += line(esc(d.name) + (d.note ? ' <span class="e-note">' + esc(d.note) + '</span>' : ''),
          money(d.total - d.paid), 'bad');
      });
      $('metricTitle').textContent = T.t('report.chip.debts');
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
      $('metricTitle').textContent = T.t('report.chip.' + m);
    }
    $('metricBody').innerHTML = rows || '<div class="empty">' + T.t('report.noMoves') + '</div>';
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

  // ----- SETTINGS -----
  function renderSettings(C) {
    const { state, $, T, version } = C;
    const P = DEK.pages;
    $('cfgShopName').value = state.shop.name;
    $('cfgStartCash').value = state.day.startCash;
    $('cfgDiscount').checked = !!state.settings.allowDiscount;
    $('cfgRefund').checked = !!state.settings.allowRefund;
    $('langAr').classList.toggle('active', T.lang === 'ar');
    $('langEn').classList.toggle('active', T.lang === 'en');
    if ($('appVersion')) $('appVersion').textContent = version;
    P.renderThemes(C);
    P.updateStorage(C);
  }

  // ----- THEMES (colors live in js/themes.js — the app just asks) -----
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
        + '<b>' + T.t(th.nameKey) + '</b></button>';
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
  function showReceipt(C, r) {
    const { state, $, T, fmt } = C;
    const { money, esc, entryTime } = fmt;
    const rec = $('receipt');
    const when = r.when || new Date().toISOString();
    $('rShop').textContent = state.shop.name;
    $('rWhen').textContent = String(when).slice(0, 10) + ' ' + entryTime(when);
    $('rClient').textContent = r.customer ? esc(r.customer) + ' #' + r.no : '#' + r.no;
    $('rLines').innerHTML = r.lines.map(function (l) {
      return '<div class="r-line"><span>' + esc(l.name) + ' <span class="r-q">×' + l.qty
        + ' @ ' + money(l.price) + '</span></span><b>' + money(l.total) + '</b></div>';
    }).join('') || '<div class="empty">—</div>';

    let t = '<div class="r-row big"><span>' + T.t('receipt.total') + '</span><b>' + money(r.net) + '</b></div>';
    if (r.discount > 0) t += '<div class="r-row dim"><span>' + T.t('sell.discount') + '</span><span>−' + money(r.discount) + '</span></div>';
    if (r.paid !== null) {
      t += '<div class="r-row"><span>' + T.t('receipt.paid') + '</span><b>' + money(r.paid) + '</b></div>';
      if (r.change > 0) t += '<div class="r-row ok"><span>' + T.t('sell.change') + '</span><b>' + money(r.change) + '</b></div>';
      else if (r.rest > 0) t += '<div class="r-row bad"><span>' + T.t('sell.rest') + '</span><b>' + money(r.rest) + '</b></div>';
    } else if (r.rest > 0) {
      t += '<div class="r-row bad"><span>' + T.t('sell.rest') + '</span><b>' + money(r.rest) + '</b></div>';
    }
    $('rTotals').innerHTML = t;
    rec.classList.remove('hidden');
    if (document.body) document.body.classList.add('no-scroll');
  }
  function hideReceipt(C) {
    const { $ } = C;
    $('receipt').classList.add('hidden');
    if (document.body) document.body.classList.remove('no-scroll');
  }

  // ----- STAFF (the team: hire / edit / fire) -----
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

    // the hire/edit form only exists when it is in flight (C.editEmployeeId)
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
    render: render, renderHeader: renderHeader, renderSell: renderSell,
    renderFreePrev: renderFreePrev, renderChange: renderChange, addToBasket: addToBasket,
    renderStock: renderStock, renderDebts: renderDebts, setNewDebt: setNewDebt,
    renderReport: renderReport, openTicket: openTicket, openMetric: openMetric,
    renderCashBox: renderCashBox, catOptions: catOptions, catChips: catChips,
    renderSettings: renderSettings, renderThemes: renderThemes, updateStorage: updateStorage,
    showReceipt: showReceipt, hideReceipt: hideReceipt, revealProductForm: revealProductForm,
    renderEmployees: renderEmployees, renderMonthly: renderMonthly
  };
});