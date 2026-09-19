/* DEKKAN — the shop webapp (prototype v1).
 * UI layer ONLY: renders state, calls the core (window.Dekkan), persists.
 * Every rule lives in core/dekkan-core.js — the app never decides business logic.
 */
'use strict';
(function () {
  const D = window.Dekkan;
  const LS_KEY = 'dekkan.v1';
  const BK_KEY = 'dekkan.backup';

  const AR = {
    sale: 'بيع', 'debt-pay': 'سداد', refund: 'استرجاع',
    buy: 'شراء مخزون', expense: 'مصروف', income: 'إيراد', check: 'عدّ الصندوق'
  };

  // ---------- state ----------
  let state = load();
  let basket = [];          // { id, qty }                 stock items
  let freeItems = [];       // { name, price, qty }        no-stock items
  let refundMode = false;
  let refundProductId = null;
  let editProductId = null;
  let payDebtId = null;

  // ---------- persistence ----------
  function save() {
    try {
      const json = JSON.stringify(state);
      localStorage.setItem(LS_KEY, json);
      localStorage.setItem(BK_KEY, json);
    } catch (e) {
      toast('تعذّر الحفظ', true);
    }
  }
  function load() {
    try {
      const a = localStorage.getItem(LS_KEY);
      if (a) return JSON.parse(a);
      const b = localStorage.getItem(BK_KEY);
      if (b) return JSON.parse(b);
    } catch (e) { /* fresh start below */ }
    return D.createShop({ name: 'متجري' });
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
  function $(id) { return document.getElementById(id); }
  function toast(msg, isErr) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.remove('hidden');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.add('hidden'); }, 2600);
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
    $('cashNow').textContent = fmt(D.cash(state)) + ' د.ت';
    $('todayLine').textContent = 'اليوم: ' + D.todayStr();
  }

  // ----- SELL -----
  function renderSell() {
    $('btnRefundMode').classList.toggle('on', refundMode);
    $('refundPanel').classList.toggle('hidden', !refundMode);

    // product tiles
    let html = '';
    state.products.forEach(function (p) {
      const low = p.lowAt > 0 && p.stock <= p.lowAt;
      const out = p.stock <= 0;
      html += '<button class="sell-tile' + (out ? ' out' : '') + '" data-id="' + p.id + '" data-action="sell-add">'
        + '<span class="t-name">' + esc(p.name) + '</span>'
        + '<span class="t-price">' + fmt(p.sell) + ' د.ت</span>'
        + '<span class="t-stock' + (low ? ' low' : '') + '">' + p.stock + ' متبقية</span>'
        + '</button>';
    });
    $('sellGrid').innerHTML = html || '<div class="empty">لا منتجات بعد — أضفها من تبويب المخزون</div>';

    // refund tiles (same products, select one)
    let rh = '';
    state.products.forEach(function (p) {
      rh += '<button class="sell-tile' + (refundProductId === p.id ? ' refundable' : '') + '" data-id="' + p.id + '" data-action="refund-pick">'
        + '<span class="t-name">' + esc(p.name) + '</span>'
        + '<span class="t-stock">' + p.stock + ' متبقية</span>'
        + '</button>';
    });
    $('refundGrid').innerHTML = rh;

    // basket
    const count = basket.reduce(function (a, b) { return a + b.qty; }, 0) +
      freeItems.reduce(function (a, b) { return a + b.qty; }, 0);
    $('basketCount').textContent = count;

    let bh = '';
    basket.forEach(function (b) {
      const p = D.getProduct(state, b.id);
      const sub = fmt(b.qty * p.sell);
      bh += '<div class="basket-line"><span>' + esc(p.name) + ' <span class="q">x' + b.qty + '</span></span>'
        + '<span class="sub">' + sub + ' د.ت</span>'
        + '<span><button class="btn ghost" data-action="basket-minus" data-id="' + b.id + '">-</button> '
        + '<button class="btn ghost" data-action="basket-plus" data-id="' + b.id + '">+</button></span></div>';
    });
    freeItems.forEach(function (f, i) {
      const sub = fmt(f.qty * f.price);
      bh += '<div class="basket-line"><span>' + esc(f.name) + ' <span class="q">x' + f.qty + '</span></span>'
        + '<span class="sub">' + sub + ' د.ت</span>'
        + '<button class="btn ghost" data-action="basket-free-del" data-i="' + i + '">✕</button></div>';
    });
    $('basketList').innerHTML = bh || '<div class="empty">السلة فارغة— اضغط على منتج</div>';

    // totals + discount
    const subtotal = basket.reduce(function (a, b) {
      const p = D.getProduct(state, b.id);
      return a + (p ? p.sell * b.qty : 0);
    }, 0) + freeItems.reduce(function (a, f) { return a + f.price * f.qty; }, 0);

    const pct = parseFloat($('discPct').value) || 0;
    const amt = parseFloat($('discAmt').value) || 0;
    const disc = amt > 0 ? Math.min(amt, subtotal) : Math.min(subtotal * pct / 100, subtotal);
    $('basketTotal').textContent = fmt(Math.max(0, subtotal - disc)) + ' د.ت';
    $('discountRow').classList.toggle('hidden', !state.settings.allowDiscount);
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
      html += '<div class="stock-card">'
        + '<span><span class="s-name">' + esc(p.name) + '</span>'
        + '<span class="s-meta">اشتراء ' + fmt(p.buy) + ' • بيع ' + fmt(p.sell) + ' • تنبيه ' + p.lowAt + '</span></span>'
        + '<span class="s-stock' + (low ? ' low' : '') + '">' + p.stock + '</span>'
        + '<span class="row gap">'
        + '<button class="btn ghost" data-action="stock-edit" data-id="' + p.id + '">تعديل</button>'
        + '<button class="btn ghost" data-action="stock-restock" data-id="' + p.id + '">+10</button>'
        + '</span></div>';
    });
    $('stockList').innerHTML = html || '<div class="empty">لا منتجات — أضف أول منتج</div>';

    $('productForm').classList.toggle('hidden', !editProductId || editProductId === 'new');
  }

  // ----- DEBTS -----
  function renderDebts() {
    const open = state.debts.filter(function (d) { return !d.settled; });
    const settled = state.debts.filter(function (d) { return d.settled; });
    let html = '';
    open.forEach(function (d) {
      const owed = d.total - d.paid;
      html += '<div class="debt-card">'
        + '<span><span class="d-name">' + esc(d.name) + '</span>'
        + '<span class="d-sub">مدفوع ' + fmt(d.paid) + ' د.ت</span></span>'
        + '<span class="row gap"><span class="d-owed">' + fmt(owed) + '</span>'
        + '<button class="btn primary" data-action="debt-pay" data-id="' + d.id + '">سداد</button>'
        + '</span></div>';
    });
    settled.forEach(function (d) {
      const owed = d.total - d.paid;
      html += '<div class="debt-card"><span><span class="d-name">' + esc(d.name) + '</span>'
        + '<span class="d-sub">مُسَدَّد ✓</span></span>'
        + '<span class="row gap"><span class="d-owed">' + fmt(owed) + '</span>'
        + '<button class="btn ghost" data-action="debt-del" data-id="' + d.id + '">✕</button></span></div>';
    });
    $('debtList').innerHTML = html || '<div class="empty">لا ديون — ممتاز</div>';
    $('debtForm').classList.toggle('hidden', !newDebtFlag);
    $('payForm').classList.toggle('hidden', !payDebtId);
  }
  let newDebtFlag = false;
  function setNewDebt(v) { newDebtFlag = v; if (!v) { payDebtId = null; $('payForm').classList.add('hidden'); } renderDebts(); }

  // ----- REPORT -----
  function renderReport() {
    const r = D.stats(state);
    const chips = [
      ['فلوس الصبح', fmt(r.startCash) + ' د.ت', ''],
      ['في الصندوق الآن', fmt(r.cash) + ' د.ت', ''],
      ['مبيعات اليوم', fmt(r.daySales) + ' د.ت', ''],
      ['استرجاعات', fmt(r.dayRefunds) + ' د.ت', ''],
      ['مصاريف', fmt(r.dayExpenses) + ' د.ت', ''],
      ['شراء مخزون', fmt(r.dayBuys) + ' د.ت', ''],
      ['ربح اليوم', fmt(r.dayProfit) + ' د.ت', r.dayProfit >= 0 ? 'profit-good' : 'profit-bad'],
      ['قيمة المخزون', fmt(r.inventoryValue) + ' د.ت', ''],
      ['ديون مفتوحة', fmt(r.debts.total) + ' د.ت', '']
    ];
    $('reportChips').innerHTML = chips.map(function (c) {
      return '<div class="chip ' + c[2] + '"><small>' + c[0] + '</small><strong>' + c[1] + '</strong></div>';
    }).join('');

    $('cashCheckExpected').textContent = 'الصندوق يجب أن يحتوي: ' + fmt(r.cash) + ' د.ت';

    let ch = '';
    r.checks.slice().reverse().forEach(function (c) {
      ch += '<div class="entry"><span>عدّ ' + entryTime(c.at) + '</span>'
        + '<span class="' + (c.ok ? 'check-ok' : 'check-bad') + '">'
        + (c.ok ? 'مطابق ✓' : ('فرق: ' + (c.diff > 0 ? '+' : '') + fmt(c.diff) + ' د.ت')) + '</span></div>';
    });
    $('checkHistory').innerHTML = ch || '<div class="empty small">لم تقم بعدّ الصندوق اليوم</div>';

    let eh = '';
    r.entries.slice().reverse().forEach(function (e) {
      const cls = e.amount > 0 ? 'in' : (e.amount < 0 ? 'out' : '');
      const amt = e.amount === 0 ? '—' : fmt(e.amount) + ' د.ت';
      eh += '<div class="entry">'
        + '<span class="e-kind">' + (AR[e.kind] || e.kind) + '</span>'
        + '<span class="growx" style="flex:1"><span>' + entryTime(e.at) + '</span>'
        + (e.note ? '<div class="e-note">' + esc(e.note) + '</div>' : '') + '</span>'
        + '<span class="e-amt ' + cls + '">' + amt + '</span>'
        + '</div>';
    });
    $('entriesList').innerHTML = eh || '<div class="empty">لا حركة اليوم بعد</div>';
  }

  // ----- SETTINGS -----
  function renderSettings() {
    $('cfgShopName').value = state.shop.name;
    $('cfgStartCash').value = state.day.startCash;
    $('cfgDiscount').checked = !!state.settings.allowDiscount;
    $('cfgRefund').checked = !!state.settings.allowRefund;
  }

  // ---------- events (bound once) ----------
  document.addEventListener('click', function (ev) {
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
      $('productFormTitle').textContent = 'تعديل: ' + p.name;
      $('pName').value = p.name; $('pBuy').value = p.buy; $('pSell').value = p.sell;
      $('pStock').value = p.stock; $('pLow').value = p.lowAt;
      $('productForm').classList.remove('hidden');
    }
    if (act === 'stock-restock') run(function (s) { return D.buyStock(s, id, 10, D.getProduct(s, id).buy); }, '+10 إلى المخزون');

    if (act === 'debt-pay') {
      payDebtId = id;
      const d = state.debts.find(function (x) { return x.id === id; });
      $('payTitle').textContent = 'سداد — ' + d.name;
      $('payAmount').value = '';
      $('payForm').classList.remove('hidden');
    }
    if (act === 'debt-del') run(function (s) { return D.removeDebt(s, id); }, 'حُذف من السجل');
  });

  $('btnSell').addEventListener('click', function () {
    const creditName = $('creditName').value.trim();
    const discAmt = parseFloat($('discAmt').value) || 0;
    const discPct = parseFloat($('discPct').value) || 0;
    let discount = null;
    if (discAmt > 0) discount = { amount: discAmt };
    else if (discPct > 0) discount = { percent: discPct };

    const items = basket.map(function (b) { return { id: b.id, qty: b.qty }; });
    if (items.length === 0 && freeItems.length === 0) return toast('السلة فارغة', true);

    try {
      if (items.length) {
        state = D.sell(state, { items: items, creditTo: creditName || undefined, discount: discount });
      }
      freeItems.forEach(function (f) {
        state = D.sellFree(state, { name: f.name, price: f.price, qty: f.qty, creditTo: creditName || undefined });
      });
      save(); basket = []; freeItems = [];
      $('discPct').value = ''; $('discAmt').value = ''; $('creditName').value = '';
      render();
      toast(creditName ? 'سُجّل على الدين: ' + creditName : 'سُجّل البيع');
    } catch (e) { toast(e.message, true); }
  });

  $('btnAddFree').addEventListener('click', function () {
    const name = $('freeName').value.trim();
    const price = parseFloat($('freePrice').value) || 0;
    const qty = parseFloat($('freeQty').value) || 1;
    if (!name) return toast('اكتب اسم السلعة', true);
    freeItems.push({ name: name, price: price, qty: qty });
    $('freeName').value = ''; $('freePrice').value = '';
    render();
  });

  $('btnRefundMode').addEventListener('click', function () {
    refundMode = !refundMode;
    refundProductId = null;
    render();
  });
  $('btnDoRefund').addEventListener('click', function () {
    if (!refundProductId) return toast('اختر منتجًا للاسترجاع', true);
    const qty = parseFloat($('refundQty').value) || 1;
    const reason = $('refundReason').value.trim();
    run(function (s) {
      return D.refund(s, { items: [{ id: refundProductId, qty: qty }], reason: reason || null });
    }, 'تم الاسترجاع');
  });

  // stock form
  $('btnAddProduct').addEventListener('click', function () {
    editProductId = 'new';
    $('productFormTitle').textContent = 'منتج جديد';
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
      if (!name) throw new Error('اكتب اسم المنتج');
      if (!(sell >= 0)) throw new Error('اكتب ثمن البيع');
      if (editProductId === 'new') {
        state = D.addProduct(state, { name: name, buy: buy, sell: sell, stock: stock, lowAt: lowAt });
      } else {
        state = D.setProduct(state, editProductId, { name: name, buy: buy, sell: sell, stock: stock, lowAt: lowAt });
      }
      save(); editProductId = null;
      $('productForm').classList.add('hidden');
      render();
      toast('تم الحفظ');
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
    if (!name || amount <= 0) return toast('اكتب الاسم والمبلغ', true);
    run(function (s) {
      return D.addDebt(s, { name: name, amount: amount, phone: $('dPhone').value.trim() || null, note: $('dNote').value.trim() || null });
    }, 'سُجّل الدين');
    setNewDebt(false);
  });
  $('btnCancelPay').addEventListener('click', function () { payDebtId = null; $('payForm').classList.add('hidden'); });
  $('btnDoPay').addEventListener('click', function () {
    const amount = parseFloat($('payAmount').value) || 0;
    if (amount <= 0) return toast('اكتب المبلغ', true);
    run(function (s) { return D.payDebt(s, payDebtId, { amount: amount }); }, 'تم السداد');
    payDebtId = null;
    $('payForm').classList.add('hidden');
  });

  // report
  $('btnCheckCash').addEventListener('click', doCheckCash);
  $('countedCash').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doCheckCash(); });
  function doCheckCash() {
    const counted = parseFloat($('countedCash').value);
    if (!(counted >= 0)) return toast('اكتب العدد الذي عاددته', true);
    $('countedCash').value = '';
    run(function (s) { return D.checkCash(s, { counted: counted }); }, 'سُجّل العدّ');
  }

  // settings
  $('btnSaveCfg').addEventListener('click', function () {
    const name = $('cfgShopName').value.trim() || 'متجري';
    const start = parseFloat($('cfgStartCash').value) || 0;
    try {
      if (state.day.entries.length === 0 && state.day.soldCost === 0) {
        state = D.updateShop(state, { name: name, startCash: start });
      } else {
        state = D.updateShop(state, { name: name });
      }
      save(); render(); toast('تم الحفظ');
    } catch (e) { toast(e.message, true); }
  });
  $('cfgDiscount').addEventListener('change', function () {
    run(function (s) { return D.setSettings(s, { allowDiscount: $('cfgDiscount').checked }); });
  });
  $('cfgRefund').addEventListener('change', function () {
    run(function (s) { return D.setSettings(s, { allowRefund: $('cfgRefund').checked }); });
  });
  $('btnCloseDay').addEventListener('click', function () {
    run(function (s) { return D.closeDay(s); }, 'أُغلق اليوم، وبدأ يوم جديد بنفس الرصيد');
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
    if (!confirm('مسح كل بيانات المحل؟ هذا لا يُرجع. (يمكنك حفظ نسخة أولًا)')) return;
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(BK_KEY);
    state = D.createShop({ name: 'متجري' });
    basket = []; freeItems = [];
    save(); render();
    toast('بدأنا من جديد');
  });

  // tabs
  const tabs = document.querySelectorAll('.tab');
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
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-hash') === hash);
    });
    render();
  }
  window.addEventListener('hashchange', navigate);
  navigate();
})();