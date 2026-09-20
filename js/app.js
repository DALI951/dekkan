/* DEKKAN — the shop webapp (v4: theme engine + till-style report).
 * UI layer ONLY: renders state, calls the core (window.Dekkan), persists.
 * Every business rule lives in core/dekkan-core.js.
 * Every user-visible string goes through T.t() (js/lang.js).
 * Every color comes from a theme token (js/themes.js) — no hardcoded colors here.
 */
'use strict';
(function () {
  const D = window.Dekkan;
  const T = window.T;
  const LS_KEY = 'dekkan.v1';
  const BK_KEY = 'dekkan.backup';
  const A_VERSION = '0.8.5';

  // ---------- state ----------
  let state = load();
  let basket = [];          // { id, qty }                 stock items
  let freeItems = [];       // { name, price, qty }        no-stock items
  let refundMode = false;
  let refundProductId = null;
  let editProductId = null;
  let payDebtId = null;
  let newDebtFlag = false;
  let receiptEntryId = null;   // entry id of the sale currently shown on the receipt (for refunds)

  // ---------- persistence ----------
  function save() {
    try {
      const json = JSON.stringify(state);
      localStorage.setItem(LS_KEY, json);
      localStorage.setItem(BK_KEY, json);
    } catch (e) {
      toast(T.t('toast.couldntSave'), true);
    }
  }
  function load() {
    try {
      const a = localStorage.getItem(LS_KEY);
      if (a) return migrate(JSON.parse(a));
      const b = localStorage.getItem(BK_KEY);
      if (b) return migrate(JSON.parse(b));
    } catch (e) { /* fresh start below */ }
    return D.createShop({ name: T.t('app.name') });
  }
  // saved states made before the customer registry existed (v2 shops)
  function migrate(s) {
    if (!s || !Array.isArray(s.customers)) {
      if (!s) s = {};
      s.customers = [];
    }
    if (!s.categories || !Array.isArray(s.categories.in) || !Array.isArray(s.categories.out)) {
      s.categories = { in: [], out: [] };
    }
    return s;
  }
  window.addEventListener('pagehide', save);

  // ---------- helpers ----------
  function run(fn, okMsg) {
    try {
      state = fn(state);
      save();
      render();
      if (okMsg) toast(okMsg);
    } catch (e) {
      toast(e.message, true);
    }
  }
  function fmt(n) { return Number(n).toFixed(3); }
  // money() is for SHOWING. For maths always use n3() (mirrors the core's rounding).
  function n3(n) { return Math.round(Number(n) * 1000) / 1000; }
  function money(n) { return fmt(n3(n)) + ' ' + T.t('curr'); }
  function $(id) { return document.getElementById(id); }
  function toast(msg, isErr, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.remove('hidden');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.add('hidden'); }, ms || 2600);
  }
  function entryTime(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function stockLeft(n) {
    const ar = T.lang === 'ar';
    return ar ? n + ' ' + T.t('stock.left') : n + ' ' + T.t('stock.leftEn');
  }

  // ---------- render ----------
  function render() {
    renderHeader();
    renderSell();
    renderStock();
    renderDebts();
    renderReport();
    renderCashBox();
    renderSettings();
  }

  function renderHeader() {
    $('shopName').textContent = state.shop.name;
    const cash = money(D.cash(state));
    $('cashNow').textContent = cash;
    if ($('cashNow2')) $('cashNow2').textContent = cash;
    $('todayLine').textContent = T.t('today') + D.todayStr();
  }

  // ----- SELL -----
  function renderSell() {
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

    renderChange(net);
    renderFreePrev();
  }

  // live line for the no-stock item form (price x qty, while you type)
  function renderFreePrev() {
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
  function renderChange(net) {
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

  function addToBasket(id) {
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
  function renderStock() {
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
  function renderDebts() {
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

  function setNewDebt(v) {
    newDebtFlag = v;
    if (!v) { payDebtId = null; $('payForm').classList.add('hidden'); }
    renderDebts();
  }

  // ----- REPORT -----
  function renderReport() {
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
        + (c.ok ? T.t('report.matched') + ' ✓' : (T.t('report.diff') + (c.diff > 0 ? '+' : '') + fmt(c.diff) + ' ' + T.t('curr'))) + '</span></div>';
    });
    $('checkHistory').innerHTML = ch || '<div class="empty">' + T.t('report.noChecks') + '</div>';

    let eh = '';
    r.entries.slice().reverse().forEach(function (e) {
      const cls = e.amount > 0 ? 'in' : (e.amount < 0 ? 'out' : 'none');
      const amt = e.amount === 0 ? '—' : money(e.amount);
      const guts = '<span class="e-kind k-' + e.kind + '">' + kindLabel(e.kind) + '</span>'
        + (e.no ? '<span class="e-no">#' + e.no + '</span>' : '')
        + '<span class="growx"><span class="e-time">' + entryTime(e.at) + '</span>'
        + (e.note ? '<span class="e-note">' + esc(e.note) + '</span>' : '') + '</span>'
        + '<span class="e-amt ' + cls + '">' + amt + '</span>';
      // a sale row IS a ticket: tap it to reopen the facture
      eh += e.kind === 'sale'
        ? '<button class="entry trow" data-action="ticket-open" data-id="' + e.id + '" data-i="' + e.no + '">'
          + guts + '<span class="e-ticket">🧾</span></button>'
        : '<div class="entry">' + guts + '</div>';
    });
    $('entriesList').innerHTML = eh || '<div class="empty">' + T.t('report.noMoves') + '</div>';
  }

  // reopen a stored sale as a facture. legacy sales (no bill, pre-facture days)
  // still print — the total plus whatever the entry remembers.
  function openTicket(e, no) {
    receiptEntryId = e.id;
    const bill = e.bill;
    showReceipt({
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
  function openMetric(m) {
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
  function renderCashBox() {
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
    $('cbInCat').innerHTML = catOptions(state.categories.in);
    $('cbOutCat').innerHTML = catOptions(state.categories.out);
    $('catInList').innerHTML = catChips(state.categories.in, 'in');
    $('catOutList').innerHTML = catChips(state.categories.out, 'out');
  }
  function catOptions(pool) {
    return '<option value="">—</option>'
      + pool.map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>'; }).join('');
  }
  function catChips(pool, side) {
    return pool.map(function (c) {
      return '<span class="chip">' + esc(c.name)
        + '<button class="chip-x" data-action="cat-del" data-id="' + c.id + '" data-i="' + side + '">×</button></span>';
    }).join('') || '<span class="muted">' + T.t('cashbox.noCats') + '</span>';
  }
  function addCat(side) {
    const inp = side === 'in' ? 'catInName' : 'catOutName';
    const v = $(inp).value.trim();
    if (!v) return;
    try {
      state = D.addCategory(state, { name: v, side: side });
      save();
      $(inp).value = '';
      render();
      toast(T.t('toast.catAdded'));
    } catch (err) {
      toast(T.t('toast.catDup'), true);
    }
  }
  function bookCash(side) {
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

  function kindLabel(k) {
    const map = {
      sale: 'kind.sale', 'debt-pay': 'kind.debtPay', refund: 'kind.refund',
      buy: 'kind.buy', expense: 'kind.expense', income: 'kind.income', check: 'kind.check'
    };
    return T.t(map[k] || k);
  }

  // ----- SETTINGS -----
  function renderSettings() {
    $('cfgShopName').value = state.shop.name;
    $('cfgStartCash').value = state.day.startCash;
    $('cfgDiscount').checked = !!state.settings.allowDiscount;
    $('cfgRefund').checked = !!state.settings.allowRefund;
    $('langAr').classList.toggle('active', T.lang === 'ar');
    $('langEn').classList.toggle('active', T.lang === 'en');
    if ($('appVersion')) $('appVersion').textContent = A_VERSION;
    renderThemes();
    updateStorage();
  }

  // ----- THEMES (colors live in js/themes.js — the app just asks) -----
  function themes() { return window.DEK && window.DEK.Themes; }

  function renderThemes() {
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

  let storageRead = false;
  function updateStorage() {
    const el = $('storageUsed');
    if (!el || storageRead) return;
    if (!(navigator.storage && navigator.storage.estimate)) return;
    storageRead = true;
    navigator.storage.estimate().then(function (est) {
      const mb = (est.usage || 0) / 1048576;
      el.textContent = (mb < 0.1 ? '<0.1' : (mb < 10 ? mb.toFixed(1) : String(Math.round(mb)))) + ' MB';
    }).catch(function () { /* stays — */ });
  }

  // ---------- events (bound once) ----------
  document.addEventListener('click', function (ev) {
    const sw = ev.target.closest('[data-theme]');
    if (sw) {
      const TH = themes();
      if (TH && TH.set(sw.getAttribute('data-theme'))) {
        renderThemes();
        toast(T.t('toast.themeOk'));
      }
      return;
    }
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const act = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');
    const i = el.getAttribute('data-i');

    if (act === 'sell-add') addToBasket(id);

    if (act === 'basket-plus') addToBasket(id); // same guard as the tiles: never over the stock
    if (act === 'basket-minus') {
      const b = basket.find(function (x) { return x.id === id; });
      if (!b) return;
      b.qty--;
      if (b.qty <= 0) basket = basket.filter(function (x) { return x.id !== id; });
      render();
    }
    if (act === 'basket-free-del') { freeItems.splice(parseInt(i, 10), 1); render(); }

    if (act === 'refund-pick') {
      refundProductId = (refundProductId === id) ? null : id;
      render();
    }

    if (act === 'stock-edit') {
      const p = D.getProduct(state, id);
      editProductId = id;
      $('productFormTitle').textContent = T.t('stock.edit') + ': ' + p.name;
      $('pName').value = p.name; $('pBuy').value = p.buy; $('pSell').value = p.sell;
      $('pStock').value = p.stock; $('pLow').value = p.lowAt;
      $('productForm').classList.remove('hidden');
      revealProductForm(); // the label only exists NOW — make sure it is actually on screen
    }
    if (act === 'stock-restock') run(function (s) { return D.buyStock(s, id, 10, D.getProduct(s, id).buy); }, T.t('toast.restock'));

    if (act === 'debt-pay') {
      payDebtId = id;
      const d = state.debts.find(function (x) { return x.id === id; });
      if (d) $('payTitle').textContent = T.t('debts.payTitle') + ' — ' + d.name;
      $('payAmount').value = '';
      $('payForm').classList.remove('hidden');
    }
    if (act === 'debt-del') run(function (s) { return D.removeDebt(s, id); }, T.t('toast.debtDeleted'));

    if (act === 'ticket-day') { /* removed: past-day browsing merged into the open day */ }
    if (act === 'ticket-open') {
      const e = (state.day.entries || []).find(function (x) { return x.id === id; });
      if (e) openTicket(e, parseInt(i, 10) || 1);
    }
    if (act === 'metric-open') openMetric(el.getAttribute('data-metric') || id);
    if (act === 'cat-del') {
      try { state = D.removeCategory(state, { side: i, id: id }); save(); } catch (err) { /* already gone */ }
      render();
    }
  });

  // ----- the till: one checkout = one client = one receipt -----
  function showReceipt(r) {
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
  function hideReceipt() {
    $('receipt').classList.add('hidden');
    if (document.body) document.body.classList.remove('no-scroll');
  }

  // Refund the sale shown on the receipt: restock its stock lines, clear its
  // free lines, and keep the paper trail. The entry id comes from the ticket
  // that opened this receipt (openTicket sets receiptEntryId).
  $('btnReceiptRefund').addEventListener('click', function () {
    if (!receiptEntryId) return toast(T.t('toast.refundPick'), true);
    const entry = (state.day.entries || []).find(function (e) { return e.id === receiptEntryId; });
    if (!entry || !entry.bill) return toast(T.t('toast.couldntSave'), true);
    const items = [], freeNames = [];
    let freeQty = 0, freePrice = 0;
    (entry.bill.lines || []).forEach(function (l) {
      if (l.id != null) items.push({ id: l.id, qty: l.qty, price: l.price });
      else { freeNames.push(l.name); freeQty += l.qty || 1; freePrice += l.total || l.price || 0; }
    });
    try {
      let s = state;
      if (items.length) s = D.refund(s, { items: items, reason: 'refund' });
      if (freeNames.length) s = D.refundFree(s, { name: freeNames.join(' + '), qty: 1, price: n3(freePrice) });
      state = s;
      save();
      receiptEntryId = null;
      hideReceipt();
      render();
      toast(T.t('toast.refundOk'));
    } catch (e) { toast(e.message, true); }
  });

  $('btnReceiptClose').addEventListener('click', hideReceipt);
  $('btnReceiptClose2').addEventListener('click', hideReceipt);
  $('btnReceiptPrint').addEventListener('click', function () {
    if (window.print) window.print(); // the print CSS turns the overlay into a clean facture
  });
  $('btnMetricClose').addEventListener('click', function () { $('metricPanel').classList.add('hidden'); if (document.body) document.body.classList.remove('no-scroll'); });
  $('metricPanel').addEventListener('click', function (ev) {
    if (ev.target === $('metricPanel')) { $('metricPanel').classList.add('hidden'); if (document.body) document.body.classList.remove('no-scroll'); }
  });
  $('receipt').addEventListener('click', function (ev) {
    if (ev.target === $('receipt')) hideReceipt();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (!$('receipt').classList.contains('hidden')) { hideReceipt(); return; }
    if (!$('metricPanel').classList.contains('hidden')) { $('metricPanel').classList.add('hidden'); if (document.body) document.body.classList.remove('no-scroll'); return; }
    const pf = $('payForm');
    if (pf && !pf.classList.contains('hidden')) pf.classList.add('hidden');
  });

  // Cancel on the record-sale form: drop the whole order, reset the till, back to products.
  $('btnCancelSell').addEventListener('click', function () {
    basket = []; freeItems = []; receiptEntryId = null;
    $('paidCash').value = ''; $('discPct').value = ''; $('discAmt').value = ''; $('creditName').value = '';
    hideReceipt(); render(); toast(T.t('toast.saleCancelled'));
  });

  $('btnSell').addEventListener('click', function () {
    const customer = $('creditName').value.trim();
    const discAmt = parseFloat($('discAmt').value) || 0;
    const discPct = parseFloat($('discPct').value) || 0;

    const items = basket.map(function (b) { return { id: b.id, qty: b.qty }; });
    const free = freeItems.map(function (f) { return { name: f.name, price: f.price, qty: f.qty }; });
    if (items.length === 0 && free.length === 0) return toast(T.t('basket.empty'), true);

    const paidRaw = $('paidCash').value.trim();
    const paid = paidRaw === '' ? null : parseFloat(paidRaw);
    if (paid !== null && (!Number.isFinite(paid) || paid < 0)) return toast(T.t('toast.paidBad'), true);

    // the whole bill: stock + free, one discount, shown before they hand money over
    const subtotal = basket.reduce(function (a, b) {
      const p = D.getProduct(state, b.id);
      return a + (p ? p.sell * b.qty : 0);
    }, 0) + freeItems.reduce(function (a, f) { return a + f.price * f.qty; }, 0);
    const disc = discAmt > 0
      ? Math.min(discAmt, subtotal)
      : Math.min(subtotal * discPct / 100, subtotal);
    const net = n3(Math.max(0, subtotal - disc));

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
          ? (discAmt > 0 ? { amount: discAmt } : { percent: discPct })
          : null,
        paid: paid === null ? undefined : paid
      };
      if (items.length) opts.items = items;
      if (free.length) opts.free = free;
      state = D.sellAll(state, opts);
      save();

      // remember which entry the receipt just showed, so its refund button works
      const es = state.day.entries || [];
      receiptEntryId = es.length ? es[es.length - 1].id : null;

      const rest = net - (paid === null ? 0 : Math.min(paid, net));
      const change = (paid === null ? 0 : Math.max(0, paid - net));
      showReceipt({
        customer: customer, no: clientNo, lines: lines,
        discount: n3(disc), net: net, paid: paid, rest: n3(rest), change: n3(change)
      });

      basket = []; freeItems = [];
      $('discPct').value = ''; $('discAmt').value = ''; $('creditName').value = ''; $('paidCash').value = '';
      render();
      if (rest > 0) toast(T.t('toast.saleRest') + money(rest) + (customer ? ' — ' + customer : ''));
      else if (customer) toast(T.t('toast.saleCredit') + customer);
      else toast(T.t('toast.saleOk'));
    } catch (e) { toast(e.message, true); }
  });

  $('btnAddFree').addEventListener('click', function () {
    const name = $('freeName').value.trim();
    const price = parseFloat($('freePrice').value) || 0;
    const qty = parseFloat($('freeQty').value) || 1;
    if (!name) return toast(T.t('toast.freeName'), true);
    freeItems.push({ name: name, price: price, qty: qty });
    $('freeName').value = ''; $('freePrice').value = '';
    render();
  });

  // the till: what was handed over + who owes the rest (live, before the sale is recorded)
  ['paidCash', 'creditName', 'discPct', 'discAmt', 'freeName', 'freePrice', 'freeQty'].forEach(function (id) {
    const el = $(id);
    if (el) el.addEventListener('input', function () { renderSell(); });
  });

  $('btnRefundMode').addEventListener('click', function () {
    refundMode = !refundMode;
    refundProductId = null;
    render();
  });  $('btnDoRefund').addEventListener('click', function () {
    if (!refundProductId) return toast(T.t('toast.refundPick'), true);
    const qty = parseFloat($('refundQty').value) || 1;
    const reason = $('refundReason').value.trim();
    run(function (s) {
      return D.refund(s, { items: [{ id: refundProductId, qty: qty }], reason: reason || null });
    }, T.t('toast.refundOk'));
  });

  // stock form
  $('btnAddProduct').addEventListener('click', function () {
    editProductId = 'new';
    $('productFormTitle').textContent = T.t('stock.new');
    $('pName').value = ''; $('pBuy').value = ''; $('pSell').value = ''; $('pStock').value = '0'; $('pLow').value = '3';
    $('productForm').classList.remove('hidden');
    revealProductForm();
  });
  // the edit label must land on screen — it lives below the product list
  function revealProductForm() {
    const f = $('productForm');
    if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('btnCancelProduct').addEventListener('click', function () {
    editProductId = null;
    $('productForm').classList.add('hidden');
  });
  $('btnSaveProduct').addEventListener('click', function () {
    const name = $('pName').value.trim();
    const buy = parseFloat($('pBuy').value) || 0;
    const sell = parseFloat($('pSell').value);
    const stock = parseInt($('pStock').value, 10) || 0;
    const lowAt = parseInt($('pLow').value, 10) || 0;
    try {
      if (!name) throw new Error(T.t('toast.prodName'));
      if (!(sell >= 0)) throw new Error(T.t('toast.prodPrice'));
      if (editProductId === 'new') {
        state = D.addProduct(state, { name: name, buy: buy, sell: sell, stock: stock, lowAt: lowAt });
      } else {
        state = D.setProduct(state, editProductId, { name: name, buy: buy, sell: sell, stock: stock, lowAt: lowAt });
      }
      save(); editProductId = null;
      $('productForm').classList.add('hidden');
      render();
      toast(T.t('toast.savedOk'));
    } catch (e) { toast(e.message, true); }
  });

  // debts form
  $('btnAddDebt').addEventListener('click', function () {
    setNewDebt(true);
    $('dName').value = ''; $('dAmount').value = ''; $('dPhone').value = ''; $('dNote').value = '';
  });
  $('btnCancelDebt').addEventListener('click', function () { setNewDebt(false); });
  $('btnSaveDebt').addEventListener('click', function () {
    const name = $('dName').value.trim();
    const amount = parseFloat($('dAmount').value) || 0;
    if (!name || amount <= 0) return toast(T.t('toast.debtName'), true);
    run(function (s) {
      return D.addDebt(s, { name: name, amount: amount, phone: $('dPhone').value.trim() || null, note: $('dNote').value.trim() || null });
    }, T.t('toast.debtOk'));
    setNewDebt(false);
  });
  $('btnCancelPay').addEventListener('click', function () { payDebtId = null; $('payForm').classList.add('hidden'); });
  $('btnDoPay').addEventListener('click', function () {
    const amount = parseFloat($('payAmount').value) || 0;
    if (amount <= 0) return toast(T.t('toast.amount'), true);
    // the only honest cap: you can never take more than the open balance
    const debt = state.debts.find(function (d) { return d.id === payDebtId; });
    const remaining = debt ? n3(debt.total - debt.paid) : 0;
    if (amount > remaining) return toast(T.t('toast.payOver') + money(remaining), true);
    run(function (s) { return D.payDebt(s, payDebtId, { amount: amount }); }, T.t('toast.payOk'));
    payDebtId = null;
    $('payForm').classList.add('hidden');
  });

  // ----- Enter = the button on every form (the till never needs a mouse) -----
  // press a button in both worlds: real browser .click(), stub DOM .fire('click')
  function press(id) {
    const el = $(id);
    if (typeof el.click === 'function') el.click();
    else el.fire('click');
  }
  function enterRuns(ids, action) {
    ids.forEach(function (id) {
      $(id).addEventListener('keydown', function (ev) {
        if (ev && ev.key === 'Enter') {
          if (ev.preventDefault) ev.preventDefault();
          action();
        }
      });
    });
  }
  enterRuns(['freeName', 'freePrice', 'freeQty'], function () { press('btnAddFree'); });
  enterRuns(['creditName', 'discPct', 'discAmt', 'paidCash'], function () { press('btnSell'); });
  enterRuns(['payAmount'], function () { press('btnDoPay'); });
  enterRuns(['dName', 'dAmount', 'dPhone', 'dNote'], function () { press('btnSaveDebt'); });
  enterRuns(['pName', 'pBuy', 'pSell', 'pStock', 'pLow'], function () { press('btnSaveProduct'); });

  // cash box
  $('btnCashIn').addEventListener('click', function () { bookCash('in'); });
  $('btnCashOut').addEventListener('click', function () { bookCash('out'); });
  $('btnCatInAdd').addEventListener('click', function () { addCat('in'); });
  $('btnCatOutAdd').addEventListener('click', function () { addCat('out'); });
  enterRuns(['cbInAmt', 'cbInSrc'], function () { press('btnCashIn'); });
  enterRuns(['cbOutAmt', 'cbOutPurpose'], function () { press('btnCashOut'); });
  enterRuns(['catInName'], function () { press('btnCatInAdd'); });
  enterRuns(['catOutName'], function () { press('btnCatOutAdd'); });

  // report
  $('btnCheckCash').addEventListener('click', doCheckCash);
  $('countedCash').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doCheckCash(); });
  function doCheckCash() {
    const counted = parseFloat($('countedCash').value);
    if (!(counted >= 0)) return toast(T.t('toast.checkAmt'), true);
    $('countedCash').value = '';
    run(function (s) { return D.checkCash(s, { counted: counted }); }, T.t('toast.checkOk'));
  }

  // settings
  $('btnSaveCfg').addEventListener('click', function () {
    const name = $('cfgShopName').value.trim() || T.t('app.name');
    const start = parseFloat($('cfgStartCash').value) || 0;
    try {
      state = D.updateShop(state, { name: name, startCash: start });
      save(); render(); toast(T.t('toast.savedOk'));
    } catch (e) { toast(e.message, true); }
  });
  $('cfgDiscount').addEventListener('change', function () {
    run(function (s) { return D.setSettings(s, { allowDiscount: $('cfgDiscount').checked }); });
  });
  $('cfgRefund').addEventListener('change', function () {
    run(function (s) { return D.setSettings(s, { allowRefund: $('cfgRefund').checked }); });
  });
  $('btnCloseDay').addEventListener('click', function () {
    run(function (s) { return D.closeDay(s); }, T.t('toast.dayClosed'));
    $('countedCash').value = '';
  });
  $('btnExport').addEventListener('click', function () {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dekkan-backup-' + D.todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('btnReset').addEventListener('click', function () {
    if (!confirm(T.t('toast.resetConfirm'))) return;
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(BK_KEY);
    state = D.createShop({ name: T.t('app.name') });
    basket = []; freeItems = [];
    save(); render();
    toast(T.t('toast.resetOk'));
  });

  // language toggle
  $('langAr').addEventListener('click', function () { T.set('ar'); });
  $('langEn').addEventListener('click', function () { T.set('en'); });
  window.addEventListener('dekkan:lang', render);
  document.addEventListener('dekkan:theme', renderThemes);

  // navigation (sidebar + bottom bar)
  const tabs = document.querySelectorAll('.tab, .navitem');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      location.hash = t.getAttribute('data-hash');
    });
  });
  function navigate() {
    const hash = location.hash || '#/sell';
    document.querySelectorAll('.page').forEach(function (p) { p.classList.add('hidden'); });
    const page = $('page-' + hash.replace('#/', '')) || $('page-sell');
    page.classList.remove('hidden');
    page.classList.add('show');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-hash') === hash);
    });
    render();
  }
  window.addEventListener('hashchange', navigate);
  navigate();
})();