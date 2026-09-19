/* DEKKAN themes tests — the registry contract.
 * Contract: EVERY theme defines the FULL token set (no missing, no extras),
 * all token values look like CSS colors, and the engine behaves sanely
 * (default = souk, unknown ids refused, set updates current, storage absent ok).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { THEMES, Themes, BASE } = require('../js/themes.js');

const CSS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent|currentColor)$/;

test('registry: at least 2 themes and souk is the default', () => {
  const ids = Object.keys(THEMES);
  assert.ok(ids.length >= 2, 'need >= 2 themes to prove the system');
  assert.ok(THEMES.souk, 'souk must exist (default)');
});

test('every theme carries the FULL base token set (no missing, no extras)', () => {
  const base = BASE.slice().sort();
  Object.keys(THEMES).forEach((id) => {
    const tk = Object.keys(THEMES[id].tokens).sort();
    assert.deepStrictEqual(tk, base, 'theme ' + id + ' token-set mismatch');
  });
});

test('every color token looks like a CSS color value (--shadow carries one)', () => {
  Object.keys(THEMES).forEach((id) => {
    const toks = THEMES[id].tokens;
    Object.keys(toks).forEach((name) => {
      const v = toks[name];
      if (/shadow$/.test(name)) {
        assert.match(v, /(rgba?\(|#[0-9a-fA-F]{3,8})/, 'theme ' + id + ' shadow has no color: ' + v);
        return;
      }
      assert.match(v, CSS_COLOR, 'theme ' + id + ' has bad value: ' + v);
    });
  });
});

test('every theme has id + nameKey + 3-color preview', () => {
  Object.keys(THEMES).forEach((id) => {
    const t = THEMES[id];
    assert.strictEqual(t.id, id);
    assert.ok(typeof t.nameKey === 'string' && t.nameKey.indexOf('theme.') === 0, id + ' nameKey');
    assert.ok(Array.isArray(t.preview) && t.preview.length === 3 && t.preview.every(c => /^#[0-9a-fA-F]{6}$/.test(c)), id + ' preview');
  });
});

test('Themes.all lists every theme; get resolves ids only', () => {
  assert.strictEqual(Themes.all().length, Object.keys(THEMES).length);
  assert.ok(Themes.get('souk'));
  assert.strictEqual(Themes.get('nope'), null);
});

test('default current theme is souk (no storage in node)', () => {
  assert.strictEqual(Themes.current().id, 'souk');
});

test('Themes.set applies, updates current, refuses unknown ids', () => {
  assert.strictEqual(Themes.set('mint'), true);
  assert.strictEqual(Themes.current().id, 'mint');
  assert.strictEqual(Themes.set('nope'), false);
  assert.strictEqual(Themes.current().id, 'mint', 'unknown id must not change the theme');
  Themes.set('souk');
});

test('THEMES and Themes agree on ids', () => {
  Themes.all().forEach((t) => {
    assert.strictEqual(THEMES[t.id], t);
  });
});