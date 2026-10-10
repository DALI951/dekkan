// DEKKAN CORE — SKU + unique SKU (workbook CAT-001, test PROD-001).
// RED-first: written before any SKU code existed.
// Rules: products gain an optional SKU that is NORMALIZED (trim, collapse
// whitespace, uppercase) and UNIQUE per shop; the sell search finds a product
// by its SKU as well as its name.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

function skuOf(s, name) { return s.products.find(function (p) { return p.name === name; }); }

test('PROD-001a: SKUs are normalized (case + whitespace) on add and update', () => {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 1, sell: 2, stock: 10, sku: '  coca-33 cl  ' });
  assert.equal(skuOf(s, 'Coca').sku, 'COCA-33 CL', 'trim + collapse + uppercase');
  s = D.setProduct(s, skuOf(s, 'Coca').id, { sku: 'fanta  350' });
  assert.equal(skuOf(s, 'Coca').sku, 'FANTA 350');
  s = D.setProduct(s, skuOf(s, 'Coca').id, { sku: '' });
  assert.equal(skuOf(s, 'Coca').sku, '', 'empty SKU stays empty');
});

test('PROD-001b: a duplicate normalized SKU is rejected (per shop) at add and update', () => {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 1, sell: 2, stock: 10, sku: 'X-1' });
  assert.throws(function () { D.addProduct(s, { name: 'Copy', buy: 1, sell: 2, stock: 5, sku: ' x-1 ' }); }, /duplicate sku/i);
  // updating another product to an existing SKU is rejected...
  s = D.addProduct(s, { name: 'Fanta', buy: 1, sell: 2, stock: 5, sku: 'Y-2' });
  assert.throws(function () { D.setProduct(s, skuOf(s, 'Fanta').id, { sku: 'X-1' }); }, /duplicate sku/i);
  // ...but updating a product to its OWN sku (already taken) is fine
  s = D.setProduct(s, skuOf(s, 'Coca').id, { sku: 'x-1' });
  assert.equal(skuOf(s, 'Coca').sku, 'X-1');
  // two shops may share an SKU (uniqueness is per shop)
  const t2 = D.createShop({ name: 'U', startCash: 50 });
  const s2 = D.addProduct(t2, { name: 'Coca', buy: 1, sell: 2, stock: 3, sku: 'X-1' });
  assert.equal(skuOf(s2, 'Coca').sku, 'X-1');
});

test('PROD-001c: the catalog search finds a product by SKU, not only by name', () => {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 1, sell: 2, stock: 10, sku: 'COCA-33' });
  s = D.addProduct(s, { name: 'Fanta Bleue', buy: 1, sell: 2, stock: 5 });
  const hits = D.searchProducts(s, 'coca-33');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, 'Coca');
  assert.equal(D.searchProducts(s, 'fanta').length, 1, 'name search still works');
  assert.equal(D.searchProducts(s, 'zzz').length, 0);
});