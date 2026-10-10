// @ts-nocheck
// JS -> TS migration (first pass): this file is the dynamic DOM / service-worker /
// vm-harness layer (loose globals + event targets). Types get tightened incrementally.
/* DEKKAN Google sign-in tests — js/auth.js loginWithGoogle on Firebase.
 *
 * Spec (written from the requirement, not from the code):
 *   - loginWithGoogle() opens the Google popup through Firebase (GoogleAuthProvider)
 *     and, on success, stores the session exactly like a normal login.
 *   - A Google provider that is not enabled (operation-not-allowed) or a popup the
 *     browser blocks both surface as the single friendly key 'auth.err.google' —
 *     never a raw crash, never "wrong password".
 *   - No network is reported as offline, not as a bad account.
 *   - Without the Firebase SDK there is nothing to pop up: same google key.
 *
 * Run: node --test
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { fakeFirebase } = require('./fake-firebase.js');

function setOnline(on) { Object.defineProperty(global, 'navigator', { value: { onLine: on }, configurable: true, writable: true }); }
setOnline(true);

function loadAuth(fake) {
  global.window = fake ? { DEKKAN_FIREBASE: fake } : {};
  delete require.cache[require.resolve('../js/auth.js')];
  const Auth = require('../js/auth.js').Auth;
  Auth.init();
  return Auth;
}

test('loginWithGoogle: the popup signs in and the session is like any other', async () => {
  const fb = fakeFirebase({ allowGoogle: true });
  const Auth = loadAuth(fb);
  const user = await Auth.loginWithGoogle();
  assert.strictEqual(user.email, 'g@shop.tn');
  assert.strictEqual(fb._calls.google.length, 1, 'the Google popup was opened');
  assert.ok(Auth.isLoggedIn(), 'a Google sign-in logs you in');
  assert.strictEqual(Auth.getUser().id, 'ug1');
});

test('loginWithGoogle: Google provider disabled maps to the google key, not a crash', async () => {
  const fb = fakeFirebase({}); // allowGoogle unset -> operation-not-allowed
  const Auth = loadAuth(fb);
  let err = null;
  try { await Auth.loginWithGoogle(); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.google');
  assert.ok(!Auth.isLoggedIn(), 'a failed Google sign-in leaves you logged out');
});

test('loginWithGoogle: a blocked popup is reported as the google key', async () => {
  const fb = fakeFirebase({ googleBlocked: true });
  const Auth = loadAuth(fb);
  let err = null;
  try { await Auth.loginWithGoogle(); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.google');
});

test('loginWithGoogle: no network says offline, not a bad account', async () => {
  setOnline(false);
  try {
    const fb = fakeFirebase({ failNetwork: true });
    const Auth = loadAuth(fb);
    let err = null;
    try { await Auth.loginWithGoogle(); } catch (e) { err = e; }
    assert.strictEqual(err && err.code, 'auth.err.offline');
  } finally {
    global.navigator = { onLine: true };
  }
});

test('loginWithGoogle: without the Firebase SDK nothing pops up — same google key', async () => {
  const Auth = loadAuth(null);
  let err = null;
  try { await Auth.loginWithGoogle(); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.google');
});