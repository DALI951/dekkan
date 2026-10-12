// DEKKAN CORE — the customization shape (`state.custom`), wave 1 of the plan in
// docs/customize-plan.md.
//
// RED-first: this file was written BEFORE the shape existed.
//
// WHY a "foundation" wave with no visible change: waves 2–6 (theme editor, brand +
// documents, editable lists + custom fields, tabs/density, French) all READ this
// block. Shipping a settings screen first would have frozen a shape we would then
// have to migrate. So this wave buys one thing only: the shape, its defaults, its
// repair-on-load path and its strict write path — all provable without a browser.
//
// The contract under test:
//   * every shop carries `custom` with the documented defaults (a fresh shop and
//     an OLD save both — an old save is repaired, never crashed on)
//   * `setCustom(state, patch)` is STRICT: a typo, an unknown section/key or an
//     out-of-range value throws and changes NOTHING (the pure-state rule)
//   * `ensureCustomState(state)` is a REPAIR: it fixes what it can read and keeps
//     every valid user value (it must never throw — it runs on boot + import)
//   * the block travels with the backup and comes back identical
//   * the integrity gate refuses a state whose custom block is nonsense
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

// ---------- defaults ----------

test('a fresh shop carries the full custom block', () => {
  const s = D.createShop({ name: 'Test' });
  assert.ok(s.custom && typeof s.custom === 'object', 'state.custom must exist on a fresh shop');
  ['brand', 'money', 'date', 'print', 'receipt', 'tabs'].forEach(section => {
    assert.ok(s.custom[section] && typeof s.custom[section] === 'object', 'custom.' + section + ' missing');
  });
  assert.strictEqual(s.custom.money.code, 'TND');
  assert.strictEqual(s.custom.money.decimals, 3, 'TND has millimes');
  assert.strictEqual(s.custom.money.position, 'after');
  assert.strictEqual(s.custom.print.size, '80mm');
  assert.strictEqual(s.custom.print.copies, 1);
  assert.strictEqual(s.custom.date.format, 'YYYY-MM-DD');
  assert.strictEqual(s.custom.date.time, '24h');
  assert.strictEqual(s.custom.docLanguage, '', 'default = follow the interface language');
});

test('the defaults are themselves valid (the gate would accept a fresh shop)', () => {
  assert.deepStrictEqual(D.customProblems(D.defaultCustom()), []);
});

test('the default tab order covers every page, exactly once', () => {
  const order = D.createShop({}).custom.tabs.order;
  assert.deepStrictEqual(order.slice().sort(), D.CUSTOM_TABS.slice().sort(), 'the order is a permutation of the known pages');
  assert.strictEqual(new Set(order).size, order.length, 'no page twice');
  assert.deepStrictEqual(D.createShop({}).custom.tabs.hidden, [], 'nothing hidden by default');
});

// ---------- setCustom: strict, pure ----------

test('setCustom merges a partial patch and returns a NEW state (the caller state is untouched)', () => {
  const before = D.createShop({ name: 'Test' });
  const snapshot = JSON.stringify(before);
  const after = D.setCustom(before, { money: { decimals: 2, symbol: 'DT' } });

  assert.notStrictEqual(after, before, 'a new object, never a mutate-in-place');
  assert.strictEqual(after.custom.money.decimals, 2);
  assert.strictEqual(after.custom.money.symbol, 'DT');
  assert.strictEqual(after.custom.money.code, 'TND', 'the untouched sibling keys survive the merge');
  assert.strictEqual(after.custom.print.size, '80mm', 'and so do the other sections');
  assert.strictEqual(JSON.stringify(before), snapshot, 'the original state is byte-identical after the call');
});

test('setCustom writes several sections in one call', () => {
  const s = D.setCustom(D.createShop({}), {
    brand: { phone: '71 000 000' },
    print: { size: '58mm', copies: 2 },
    tabs: { hidden: ['monthly', 'employees'] }
  });
  assert.strictEqual(s.custom.brand.phone, '71 000 000');
  assert.strictEqual(s.custom.print.size, '58mm');
  assert.strictEqual(s.custom.print.copies, 2);
  assert.deepStrictEqual(s.custom.tabs.hidden, ['monthly', 'employees']);
});

test('setCustom REFUSES nonsense — and a refusal changes nothing', () => {
  const s = D.createShop({ name: 'Test' });
  const snapshot = JSON.stringify(s);
  const bad = [
    [{ money: { decimals: 9 } }, 'decimals out of range'],
    [{ money: { decimals: 2.5 } }, 'decimals must be a whole number'],
    [{ money: { position: 'middle' } }, 'unknown currency position'],
    [{ money: { symbol: 'too-long-symbol' } }, 'a symbol that is not a symbol (wave 3: "" is legal and means "the language word")'],
    [{ money: { digits: 'roman' } }, 'unknown numerals'],
    [{ money: { thousands: 'x' } }, 'unknown thousands separator'],
    [{ print: { size: '11in' } }, 'unknown paper size'],
    [{ print: { copies: 0 } }, 'at least one copy'],
    [{ print: { autoPrint: 'yes' } }, 'a boolean is a boolean'],
    [{ date: { format: 'DD-MM-YY' } }, 'unknown date format'],
    [{ date: { time: '13h' } }, 'unknown clock'],
    [{ brand: { phone: 12345 } }, 'a phone is text'],
    [{ receipt: { qr: 'maybe' } }, 'a boolean is a boolean'],
    [{ tabs: { order: ['sell', 'sell'] } }, 'a page cannot appear twice'],
    [{ tabs: { order: ['nope', 'sell'] } }, 'an unknown page'],
    [{ tabs: { hidden: ['nope'] } }, 'hiding an unknown page'],
    [{ nonsense: { a: 1 } }, 'an unknown section (typo guard)'],
    [{ money: { decimls: 3 } }, 'a typo inside a known section (typo guard)'],
    [{ docLanguage: 42 }, 'a language id is text']
  ];
  /* /^custom/i: the core names the block, and a "setCustom is not a function"
     TypeError must NOT be able to pass this test for the wrong reason. */
  bad.forEach(([patch, why]) => {
    assert.throws(() => D.setCustom(s, patch), /custom:/i, why + ' must be refused');
  });
  assert.strictEqual(JSON.stringify(s), snapshot, 'nothing was written by any refused call');
});

test('setCustom refuses a hidden tab that is not in the order', () => {
  const s = D.setCustom(D.createShop({}), { tabs: { order: D.CUSTOM_TABS.filter(t => t !== 'monthly') } });
  assert.strictEqual(s.custom.tabs.order.indexOf('monthly'), -1, 'a shop may reorder the tabs it shows');
  assert.throws(() => D.setCustom(s, { tabs: { hidden: ['monthly'] } }), /custom:/i,
    'hiding a page that is not in the order is a contradiction');
});

// ---------- ensureCustomState: the repair path (boot + import) ----------

test('an old save with no custom gets the defaults, repaired not crashed', () => {
  const old = D.createShop({ name: 'Old Shop' });
  delete old.custom;
  const fixed = D.ensureCustomState(old);
  assert.ok(fixed.custom, 'the repair adds the block');
  assert.deepStrictEqual(fixed.custom, D.defaultCustom());
  assert.strictEqual(fixed.shop.name, 'Old Shop', 'and touches nothing else');
});

test('the repair keeps every value a shop could really have set', () => {
  const old = D.createShop({});
  old.custom = { money: { symbol: 'DT', decimals: 0 }, print: { size: 'A4' }, tabs: { order: ['sell', 'stock'], hidden: ['stock'] } };
  const fixed = D.ensureCustomState(old);
  assert.strictEqual(fixed.custom.money.symbol, 'DT', 'a real choice is kept');
  assert.strictEqual(fixed.custom.money.decimals, 0, '0 is a real choice (not "missing")');
  assert.strictEqual(fixed.custom.print.size, 'A4');
  assert.deepStrictEqual(fixed.custom.tabs.order, ['sell', 'stock'], 'a shop may show fewer pages');
  assert.deepStrictEqual(fixed.custom.tabs.hidden, ['stock'], 'and hide one of them');
  assert.strictEqual(fixed.custom.money.code, 'TND', 'the rest is filled from the defaults');
  assert.strictEqual(fixed.custom.print.copies, 1);
});

test('the repair drops what cannot be read and is idempotent', () => {
  const broken = D.createShop({});
  broken.custom = { money: { decimals: 'three', position: 'sideways' }, print: { size: '11in', copies: -2 }, tabs: { order: ['sell', 'nope', 'sell'], hidden: ['clients'] }, brand: null };
  const once = D.ensureCustomState(broken);
  assert.strictEqual(once.custom.money.decimals, 3, 'unreadable value -> default');
  assert.strictEqual(once.custom.money.position, 'after');
  assert.strictEqual(once.custom.print.size, '80mm');
  assert.strictEqual(once.custom.print.copies, 1);
  assert.deepStrictEqual(once.custom.tabs.order, D.CUSTOM_TABS, 'an unreadable order falls back to every page');
  assert.deepStrictEqual(once.custom.tabs.hidden, [], 'and a hidden page outside the order is dropped');
  assert.deepStrictEqual(once.custom.brand, D.defaultCustom().brand, 'a section that is not an object falls back');
  const twice = D.ensureCustomState(JSON.parse(JSON.stringify(once)));
  assert.strictEqual(JSON.stringify(twice.custom), JSON.stringify(once.custom), 'a repaired state repairs to itself');
});

// ---------- backup / integrity ----------

test('custom travels with the backup and comes back identical', () => {
  let s = D.createShop({ name: 'Backup Shop' });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10, lowAt: 3 });
  s = D.setCustom(s, { money: { decimals: 2 }, print: { size: '58mm' }, brand: { tagline: 'épicerie' } });
  const restored = D.restoreState(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(restored.custom, s.custom);
  assert.strictEqual(restored.custom.brand.tagline, 'épicerie', 'accents survive the round trip');
});

test('a backup from BEFORE the custom block restores with the defaults (a migration path, not a version bump)', () => {
  const s = D.createShop({ name: 'Old Backup' });
  delete s.custom;
  const restored = D.restoreState(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(restored.version, 4, 'the state shape version stays 4 — this is backwards-compatible');
  assert.deepStrictEqual(restored.custom, D.defaultCustom());
});

test('the integrity gate refuses a state whose custom block is nonsense', () => {
  const s = D.createShop({});
  const forged = JSON.parse(JSON.stringify(s));
  forged.custom.print.size = '11in';
  const problems = D.stateProblems(forged);
  assert.ok(problems.some(p => /custom/i.test(p)), 'the gate must name the custom block: ' + problems.join(' | '));
  assert.deepStrictEqual(D.stateProblems(D.createShop({})), [], 'a fresh shop still passes');
});

test('the gate names the FIRST custom problem, not all of them (the "problems[0]" style)', () => {
  const forged = D.createShop({});
  forged.custom.money.decimals = 7;
  forged.custom.print.size = 'nope';
  const problems = D.customProblems(forged.custom);
  assert.ok(problems.length >= 2, 'both are reported by the helper');
  assert.match(problems[0], /money|decimals/i, 'most-wrong-first is enough for the gate');
});
