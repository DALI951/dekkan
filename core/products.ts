/* DEKKAN CORE — products (deps: uid, money, cash, pushEntry, rollover, sell, clone, idTrusted).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { uid, money, cash, pushEntry, rollover, sell, clone, idTrusted, stockMove } = K;


// ---------- SKU (CAT-001 / PROD-001) ----------
// Normalize: trim, collapse inner whitespace, uppercase. Collision rule:
// unique PER SHOP (two shops may share an SKU — the sell screen is one shop).
function normalizeSku(raw) {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().replace(/\s+/g, ' ').toUpperCase();
}


// the error thrown on collision — distinctive so the UI can translate it
function duplicateSkuError(incoming) {
  return new Error('duplicate sku: ' + incoming);
}


function assertSkuFree(state, sku, exceptId) {
  if (!sku) return;
  const hit = state.products.find(function (p) { return p.sku === sku && p.id !== exceptId; });
  if (hit) throw duplicateSkuError(sku);
}


// the catalog search: name OR normalized SKU, case-insensitive substring
function searchProducts(state, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return state.products.slice();
  return state.products.filter(function (p) {
    return p.name.toLowerCase().indexOf(needle) !== -1 ||
      (p.sku || '').toLowerCase().indexOf(needle) !== -1;
  });
}


// ---------- products ----------

function addProduct(state, p) {
  state = rollover(clone(state));
  if (!p || typeof p.name !== 'string' || !p.name.trim()) throw new Error('product needs a name');
  if (typeof p.sell !== 'number' || p.sell < 0) throw new Error('product needs a valid sell price');
  if (p.stock != null && (!Number.isFinite(p.stock) || p.stock < 0)) throw new Error('stock cannot be negative');
  if (p.lowAt != null && (!Number.isFinite(p.lowAt) || p.lowAt < 0)) throw new Error('lowAt cannot be negative');
  const sku = normalizeSku(p.sku);
  assertSkuFree(state, sku, null);
  const item = {
    id: uid(),
    name: p.name.trim(),
    buy: money(p.buy || 0),
    sell: money(p.sell),
    stock: Math.floor(p.stock || 0),
    lowAt: Math.floor(p.lowAt || 0),
    sku: sku
  };
  state.products.push(item);
  // the first shelf movement is the opening count (source-linked ledger)
  if (item.stock !== 0) stockMove(state, item.id, item.stock, 'opening', null, null);
  return state;
}


function getProduct(state, id) {
  const real = idTrusted(state, id);
  return state.products.find(function (x) { return x.id === real; });
}


function setProduct(state, id, patch) {
  state = rollover(clone(state));
  const p = getProduct(state, id);
  if (!p) throw new Error('product not found');
  if ('name' in patch && (typeof patch.name !== 'string' || !patch.name.trim())) throw new Error('name invalid');
  if ('sell' in patch && (typeof patch.sell !== 'number' || patch.sell < 0)) throw new Error('sell price invalid');
  if ('buy' in patch && (typeof patch.buy !== 'number' || patch.buy < 0)) throw new Error('buy price invalid');
  if ('stock' in patch && !Number.isFinite(patch.stock)) throw new Error('stock invalid');
  if ('stock' in patch && patch.stock < 0) throw new Error('stock cannot be negative');
  if ('lowAt' in patch && !Number.isFinite(patch.lowAt)) throw new Error('lowAt invalid');
  if ('lowAt' in patch && patch.lowAt < 0) throw new Error('lowAt cannot be negative');
  if ('stock' in patch) patch.stock = Math.floor(patch.stock);
  if ('lowAt' in patch) patch.lowAt = Math.floor(patch.lowAt);
  if ('sku' in patch) patch.sku = normalizeSku(patch.sku);
  if ('sku' in patch) assertSkuFree(state, patch.sku, p.id);
  const oldStock = p.stock;
  for (const k in patch) p[k] = patch[k];
  // a direct stock edit is an ADJUSTMENT, never a silent overwrite (the workbook rule)
  if ('stock' in patch && p.stock !== oldStock) {
    stockMove(state, p.id, p.stock - oldStock, 'adjust', null, patch.stockReason || null);
  }
  return state;
}


// Remove a product (only if it has no stock left — you can't delete what's in your shop).
function removeProduct(state, id) {
  state = rollover(clone(state));
  const p = getProduct(state, id);
  if (!p) throw new Error('product not found');
  if (p.stock > 0) throw new Error('product still has stock: ' + p.stock);
  state.products = state.products.filter(function (x) { return x.id !== p.id; });
  return state;
}


// ---------- discount (optional, toggleable via shop.settings.allowDiscount) ----------

// computes the money taken off a revenue. throws if discounts are turned off.
function discountOff(state, revenue, discountOrNull) {
  if (!discountOrNull) return 0;
  if (!state.settings.allowDiscount) throw new Error('discounts are turned off');
  if (discountOrNull.percent != null) {
    if (!Number.isFinite(discountOrNull.percent) || discountOrNull.percent < 0 || discountOrNull.percent > 100) {
      throw new Error('discount percent must be between 0 and 100');
    }
    return money(revenue * discountOrNull.percent / 100);
  }
  if (discountOrNull.amount != null) {
    if (!Number.isFinite(discountOrNull.amount) || discountOrNull.amount < 0) {
      throw new Error('discount amount must be a positive number');
    }
    return Math.min(money(discountOrNull.amount), revenue); // never below zero
  }
  throw new Error('discount needs percent or amount');
}


// ---------- money movements ----------

// Buying stock: cash out (-qty*unitBuy), product stock up.
function buyStock(state, productId, qty, unitBuy) {
  state = rollover(clone(state));
  const p = getProduct(state, productId);
  if (!p) throw new Error('product not found');
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty must be positive');
  const u = money(unitBuy);
  if (u < 0) throw new Error('unit buy price cannot be negative');
  const total = money(qty * u);
  p.stock += Math.floor(qty);
  pushEntry(state, 'buy', -total, productId, p.name + ' x' + Math.floor(qty));
  // the restock is a shelf movement, linked to the buy entry it belongs to
  stockMove(state, p.id, Math.floor(qty), 'buy', state.day.entries[state.day.entries.length - 1].id, p.name + ' x' + Math.floor(qty));
  return state;
}

  K.addProduct = addProduct;
  K.getProduct = getProduct;
  K.setProduct = setProduct;
  K.removeProduct = removeProduct;
  K.discountOff = discountOff;
  K.buyStock = buyStock;
K.normalizeSku = normalizeSku;
K.searchProducts = searchProducts;
});
