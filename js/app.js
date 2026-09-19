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
  const A_VERSION = '0.5.0';

  // ---------- state ----------
  let state = load();
  let basket = [];          // { id, qty }                 stock items
  let freeItems = [];       // { name, price, qty }        no-stock items
  let refundMode = false;
  let refundProductId = null;
  let editProductId = null;
  let payDebtId = null;
  let newDebtFlag = false;

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
      if (a) return JSON.parse(a);
      const b = localStorage.getItem(BK_KEY);
      if (b) return JSON.parse(b);
    } catch (e) { /* fresh start below */ }
    return D.createShop({ name: T.t('app.name') });
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
      html += '<button class="sell-tile' + (out ? ' out' : '') + '" data-id="' + p.id + '" data-action="sell-add">'
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
    $('dueHint').textContent = net > 0 ? parts.join(' · ') : T.t('sell.nothingYet');

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
      if (net > 0 && name) { txt = T.t('sell.onCredit') + ' ' + name; cls += ' warn'; }
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
    const hit = basket.find(function (b) { return b.id === id; });
    if (hit) hit.qty++;
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
        + '<span class="s-meta">' + T.t('stock.buy') + ' ' + money(p.buy) + ' • ' + T.t('stock.sell') + ' ' + money(p.sell) + '</span></span>'
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
      + ' · ' + T.t('report.chip.profit')
      + ' <b class="' + (r.dayProfit >= 0 ? 'ok' : 'bad') + '">' + money(r.dayProfit) + '</b></div>';

    const chips = [
      [T.t('report.chip.inventory'), money(r.inventoryValue), ''],
      [T.t('report.chip.debts'), money(r.debts.total), r.debts.count ? 'bad' : ''],
      [T.t('report.chip.sales'), money(r.daySales), 'good'],
      [T.t('report.chip.refunds'), money(r.dayRefunds), ''],
      [T.t('report.chip.expenses'), money(r.dayExpenses), ''],
      [T.t('report.chip.buys'), money(r.dayBuys), ''],
      [T.t('report.chip.low'), String(r.lowStock.length), r.lowStock.length ? 'bad' : 'good']
    ];
    $('reportChips').innerHTML = chips.map(function (c) {
      return '<div class="metric"><span class="lab">' + c[0] + '</span>'
        + '<span class="val ' + c[2] + '">' + c[1] + '</span></div>';
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
      eh += '<div class="entry">'
        + '<span class="e-kind k-' + e.kind + '">' + kindLabel(e.kind) + '</span>'
        + '<span class="growx"><span class="e-time">' + entryTime(e.at) + '</span>'
        + (e.note ? '<span class="e-note">' + esc(e.note) + '</span>' : '') + '</span>'
        + '<span class="e-amt ' + cls + '">' + amt + '</span>'
        + '</div>';
    });
    $('entriesList').innerHTML = eh || '<div class="empty">' + T.t('report.noMoves') + '</div>';
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

    if (act === 'basket-plus') { const b = basket.find(function (x) { return x.id === id; }); if (b) b.qty++; render(); }
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
  });

  $('btnSell').addEventListener('click', function () {
    const creditName = $('creditName').value.trim();
    const discAmt = parseFloat($('discAmt').value) || 0;
    const discPct = parseFloat($('discPct').value) || 0;
    let discount = null;
    if (discAmt > 0) discount = { amount: discAmt };
    else if (discPct > 0) discount = { percent: discPct };

    const items = basket.map(function (b) { return { id: b.id, qty: b.qty }; });
    if (items.length === 0 && freeItems.length === 0) return toast(T.t('basket.empty'), true);

    const paidRaw = $('paidCash').value.trim();
    const paid = paidRaw === '' ? null : parseFloat(paidRaw);
    if (paid !== null && (!Number.isFinite(paid) || paid < 0)) return toast(T.t('toast.paidBad'), true);

    // net of the whole till (stock items + free items, minus the discount)
    const stockSubtotal = basket.reduce(function (a, b) {
      const p = D.getProduct(state, b.id);
      return a + (p ? p.sell * b.qty : 0);
    }, 0);
    const freeSubtotal = freeItems.reduce(function (a, f) { return a + f.price * f.qty; }, 0);
    const stockDisc = discAmt > 0
      ? Math.min(discAmt, stockSubtotal)
      : Math.min(stockSubtotal * discPct / 100, stockSubtotal);
    const stockNet = n3(Math.max(0, stockSubtotal - stockDisc));
    const tillNet = n3(stockNet + freeSubtotal);

    if (paid !== null && paid < tillNet && !creditName) return toast(T.t('toast.restName'), true);

    // Spread what was handed over across the calls, so cash NEVER counts money twice.
    // left = still unallocated cash; each sale takes min(left, its own net).
    let left = paid;
    function withPaid(net, extra) {
      if (left === null) {
        return Object.assign({ creditTo: creditName || undefined }, extra);
      }
      const take = n3(Math.min(left, net));
      left = n3(left - take);
      return Object.assign({ paid: take, creditTo: (take < net ? creditName : '') || undefined }, extra);
    }

    try {
      if (items.length) {
        state = D.sell(state, withPaid(stockNet, { items: items, discount: discount }));
      }
      freeItems.forEach(function (f) {
        state = D.sellFree(state, withPaid(money(f.price * f.qty), { name: f.name, price: f.price, qty: f.qty }));
      });
      const change = paid !== null ? n3(Math.max(0, paid - tillNet)) : 0;
      save(); basket = []; freeItems = [];
      $('discPct').value = ''; $('discAmt').value = ''; $('creditName').value = ''; $('paidCash').value = '';
      render();
      if (change > 0) {
        // the one number the shopkeeper must act on right now
        toast(T.t('toast.change') + ' ' + money(change), false, 9000);
      } else if (paid !== null && paid < tillNet) {
        toast(T.t('toast.saleRest') + ' ' + money(tillNet - paid) + ' — ' + creditName);
      } else {
        toast(creditName ? T.t('toast.saleCredit') + creditName : T.t('toast.saleOk'));
      }
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
  });
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
    run(function (s) { return D.payDebt(s, payDebtId, { amount: amount }); }, T.t('toast.payOk'));
    payDebtId = null;
    $('payForm').classList.add('hidden');
  });

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