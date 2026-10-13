// @ts-nocheck
/* DEKKAN themes, wave 5 ??? the SHOP's PALETTE.
 *
 * Dali's words: "the user chose 3 colors and a new palet get created depending on
 * the 3 chosen colors, not edit the own app themes that shouldnt be customiwale".
 *
 * So the app's own themes (souk / mint / royal) are read-only PRESETS, and what a
 * shopkeeper picks is THREE colours: his brand, his money, his walls. The other
 * thirty-nine tokens are derived ??? deterministically ??? from those three, because a
 * shopkeeper thinks "my colours", not "rgba(245,220,180,.08)".
 *
 * The contract this file locks:
 *   * palette(seeds) -> exactly the app's own 42 tokens, and that set passes the
 *     engine's OWN validator (problems()), so a generated shop can never be a broken
 *     theme.
 *   * the same three colours always build the same shop (no randomness, no clock).
 *   * the shopkeeper's three colours DRIVE what he thinks they drive: brand -> the
 *     accent family, money -> the coin, walls -> the surface ladder. Editing one must
 *     not quietly move the others.
 *   * READABILITY WINS: whatever he picks, the text on the wall, the muted text, the
 *     accent on the wall and the label on the accent all clear a real WCAG contrast
 *     floor. A shop that cannot be read is not a shop, so the engine nudges lightness
 *     instead of printing a screen he cannot use.
 *   * junk in the seeds falls back to the app's own colour ??? never a broken palette.
 *
 * RED-first: written before any of it exists.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const ROOT = path.join(__dirname, '..');

function boot() {
  const applied = {};
  const doc = {
    documentElement: { style: { setProperty: (k, v) => { applied[k] = v; } } },
    dispatchEvent() {}
  };
  const store = {};
  const sandbox = {
    console,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    document: doc,
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'ui', 'themes.ts'), 'utf8')), sandbox, { filename: 'ui/themes.ts' });
  return { Themes: sandbox.DEK.Themes, BASE: sandbox.DEK.BASE, applied };
}

const T = boot().Themes;
const BASE = boot().BASE;
const FULL_SEEDS = { brand: '#e8b04b', money: '#f8d184', ground: '#0e0c0a' };
const LIGHT_SEEDS = { brand: '#b3541e', money: '#b8860b', ground: '#f4ecdd' };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => {
  const c = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// a seeded PRNG: the readability sweep must be reproducible, never flaky
function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const hexColor = (r) => '#' + [0, 1, 2].map(() => Math.floor(r() * 256).toString(16).padStart(2, '0')).join('');

test('three colours in, the app\'s own 42 tokens out', () => {
  const P = T.palette(FULL_SEEDS);
  assert.strictEqual(Object.keys(P).sort().join(','), BASE.slice().sort().join(','), 'exactly the base token set, no more, no less');
});

test('a generated shop passes the engine\'s own validator (it can never be a broken theme)', () => {
  const P = T.palette(FULL_SEEDS);
  const problems = T.problems({ id: 'shop', nameKey: 'theme.custom', preview: ['#111111', '#222222', '#333333'], tokens: P });
  assert.strictEqual(problems.join(' | '), '', 'the palette must satisfy the same rule the app enforces at boot');
});

test('the same three colours always build the same shop (no randomness, no clock)', () => {
  assert.deepStrictEqual(T.palette(FULL_SEEDS), T.palette(FULL_SEEDS));
  assert.notDeepStrictEqual(T.palette(FULL_SEEDS), T.palette(LIGHT_SEEDS));
});

test('the brand colour drives the ACCENT family ??? and does not move the walls or the money', () => {
  const a = T.palette(FULL_SEEDS);
  const b = T.palette({ brand: '#2f9be0', money: FULL_SEEDS.money, ground: FULL_SEEDS.ground });
  const moved = ['--acc', '--acc2', '--accdark', '--accbg', '--accborder', '--accover', '--accglow'];
  moved.forEach((k) => assert.notStrictEqual(a[k], b[k], k + ' follows the brand colour'));
  ['--bg', '--panel', '--coin1', '--coin2', '--coin3'].forEach((k) => {
    assert.strictEqual(a[k], b[k], k + ' must NOT move when only the brand colour changes');
  });
});

test('the money colour drives the COIN ??? and the symbol on that coin stays legible', () => {
  const a = T.palette(FULL_SEEDS);
  const b = T.palette({ brand: FULL_SEEDS.brand, money: '#3ad17a', ground: FULL_SEEDS.ground });
  ['--coin1', '--coin2', '--coin3'].forEach((k) => assert.notStrictEqual(a[k], b[k], k + ' follows the money colour'));
  ['--bg', '--panel', '--acc'].forEach((k) => assert.strictEqual(a[k], b[k], k + ' must not move with the money colour'));

  const coins = [FULL_SEEDS.money, '#3ad17a', '#ffffff', '#000000', '#7a5a12'];
  coins.forEach((m) => {
    assert.ok(ratio(T.inkOn(m), m) >= 4.5, 'the symbol printed on a coin of ' + m + ' must be readable');
  });
});

test('the wall colour builds a LADDER of surfaces, in both a dark and a light shop', () => {
  [FULL_SEEDS, LIGHT_SEEDS].forEach((seeds) => {
    const P = T.palette(seeds);
    const ladder = ['--bg', '--bg2', '--panel', '--panel2', '--panel3'].map((k) => lum(P[k]));
    for (let i = 1; i < ladder.length; i++) {
      assert.ok(ladder[i] > ladder[i - 1], 'surface ' + i + ' must sit above surface ' + (i - 1) + ' for ' + seeds.ground);
    }
  });
});

test('a light wall gives a LIGHT shop ??? the app is not dark-only', () => {
  const P = T.palette(LIGHT_SEEDS);
  assert.ok(lum(P['--bg']) > 0.5, 'the wall is as light as the shopkeeper picked');
  assert.ok(lum(P['--txt']) < 0.2, 'and the text on it is dark, not near-white');
  const D = T.palette(FULL_SEEDS);
  assert.ok(lum(D['--bg']) < 0.1 && lum(D['--txt']) > 0.6, 'a dark wall still gets light text');
});

test('every generated shop is READABLE: text, muted text, dim text and the accent on the wall', () => {
  const r = rand(20261012);
  for (let i = 0; i < 300; i++) {
    const seeds = { brand: hexColor(r), money: hexColor(r), ground: hexColor(r) };
    const P = T.palette(seeds);
    const label = ' for ' + JSON.stringify(seeds);
    assert.ok(ratio(P['--txt'], P['--bg']) >= 4.5, 'body text on the wall' + label);
    assert.ok(ratio(P['--mut'], P['--bg']) >= 4.5, 'muted text on the wall' + label);
    assert.ok(ratio(P['--dim'], P['--bg']) >= 3, 'dim text on the wall' + label);
    assert.ok(ratio(P['--acc'], P['--bg']) >= 3, 'the accent against the wall' + label);
    assert.ok(ratio(P['--ink'], P['--acc']) >= 4.5, 'the label on an accent button' + label);
  }
});

test('a dark or a light wall gets REALLY readable text (AA+ at 7:1, not just the floor)', () => {
  [FULL_SEEDS, LIGHT_SEEDS].forEach((seeds) => {
    const P = T.palette(seeds);
    assert.ok(ratio(P['--txt'], P['--bg']) >= 7, 'body text on ' + seeds.ground);
    assert.ok(ratio(P['--mut'], P['--bg']) >= 4.5, 'muted text on ' + seeds.ground);
    assert.ok(ratio(P['--acc'], P['--bg']) >= 3, 'the accent on ' + seeds.ground);
  });
});

test('a brand the shopkeeper picked to be invisible on his own wall is nudged until it can be seen', () => {
  const P = T.palette({ brand: '#0e0c0a', money: '#0e0c0a', ground: '#0e0c0a' });
  assert.ok(ratio(P['--acc'], P['--bg']) >= 3, 'the accent is lifted off a wall of the same colour');
  assert.ok(ratio(P['--coin1'], P['--coin3']) > 1.05, 'and the coin still has a gradient, not one flat blob');
  const Q = T.palette({ brand: '#ffffff', money: '#ffffff', ground: '#ffffff' });
  assert.ok(ratio(Q['--txt'], Q['--bg']) >= 7, 'an all-white pick still produces a readable screen');
  assert.ok(ratio(Q['--acc'], Q['--bg']) >= 3, 'and a visible accent on it');
});

test('three colours in -> the SAME three colours back out (the pickers show the truth)', () => {
  const back = T.seedsOf('souk', T.palette(LIGHT_SEEDS));
  assert.strictEqual(JSON.stringify(back), JSON.stringify({ brand: '#b3541e', money: '#b8860b', ground: '#f4ecdd' }));
  assert.strictEqual(JSON.stringify(T.seedsOf('souk', {})), JSON.stringify({ brand: '#e8b04b', money: '#e8b04b', ground: '#0e0c0a' }),
    'a shop with no palette of its own shows the app\'s own three colours');
  const one = T.seedsOf('mint', { '--acc': '#ff0000' });
  assert.strictEqual(one.brand, '#ff0000', 'a partial override shows what it does say');
  assert.strictEqual(one.money, '#2fce8a', 'and falls back to its base theme for the rest');
});

test('a seed that is not a colour falls back to the app\'s own colour, and never breaks the shop', () => {
  const P = T.palette({ brand: 'not a colour', money: null, ground: 12345 });
  assert.strictEqual(Object.keys(P).sort().join(','), BASE.slice().sort().join(','));
  assert.strictEqual(P['--acc'], '#e8b04b', 'the brand falls back to the default theme\'s accent');
  assert.strictEqual(JSON.stringify(T.palette({})), JSON.stringify(T.palette({ brand: null, money: '', ground: undefined })));
  assert.strictEqual(T.problems({ id: 'shop', nameKey: 'k', preview: ['#000000', '#000000', '#000000'], tokens: P }).join(' | '), '');
});

test('the three seed slots are named, and each one points at the token a shopkeeper would point at', () => {
  assert.strictEqual(T.SEEDS.join(','), 'brand,money,ground');
  assert.strictEqual(T.SEED_TOKEN.brand, '--acc');
  assert.strictEqual(T.SEED_TOKEN.money, '--coin2');
  assert.strictEqual(T.SEED_TOKEN.ground, '--bg');
});

