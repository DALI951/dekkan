/* DEKKAN CORE — products (deps: uid, money, cash, pushEntry, rollover, sell, clone, idTrusted).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { uid, money, cash, pushEntry, rollover, sell, clone, idTrusted } = K;


// ---------- products ----------

function addProduct(state, p) {
  state = rollover(clone(state));
  if (!p || typeof p.name !== 'string' || !p.name.trim()) throw new Error('product needs a name');
  if (typeof p.sell !== 'number' || p.sell < 0) throw new Error('product needs a valid sell price');
  state.products.push({
    id: uid(),
    name: p.name.trim(),
    buy: money(p.buy || 0),
    sell: money(p.sell),
    stock: Math.floor(p.stock || 0),
    lowAt: Math.floor(p.lowAt || 0)
  });
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
  if ('lowAt' in patch && !Number.isFinite(patch.lowAt)) throw new Error('lowAt invalid');
  if ('stock' in patch) patch.stock = Math.floor(patch.stock);
  if ('lowAt' in patch) patch.lowAt = Math.floor(patch.lowAt);
  for (const k in patch) p[k] = patch[k];
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
  return state;
}

  K.addProduct = addProduct;
  K.getProduct = getProduct;
  K.setProduct = setProduct;
  K.removeProduct = removeProduct;
  K.discountOff = discountOff;
  K.buyStock = buyStock;
});
