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
const { fakeFirebase } = require('./fake-firebase.ts');

function setOnline(on) { Object.defineProperty(global, 'navigator', { value: { onLine: on }, configurable: true, writable: true }); }
setOnline(true);

function loadAuth(fake) {
  global.window = fake ? { DEKKAN_FIREBASE: fake } : {};
  delete require.cache[require.resolve('../ui/auth.ts')];
  const Auth = require('../ui/auth.ts').Auth;
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

/* CHANGED 2026-10-13 (was: "a blocked popup is reported as the google key").
   A blocked popup is no longer a dead end — it re-routes to the redirect sign-in
   (see the fallback test below). The old expectation is kept here as a note, in
   the shape of the new contract: the caller still gets ONE friendly key to show. */
test('loginWithGoogle: a blocked popup never surfaces a raw browser error', async () => {
  const fb = fakeFirebase({ googleBlocked: true });
  const Auth = loadAuth(fb);
  let err = null;
  try { await Auth.loginWithGoogle(); } catch (e) { err = e; }
  assert.ok(err && err.code && err.code.indexOf('auth.err.') === 0, 'a friendly key, never a raw crash');
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

test('loginWithGoogle: a browser that BLOCKS popups falls back to the redirect route', async () => {
  /* why the contract changed (2026-10-13): "google sign in dont work" — on a
     phone or an in-app browser the popup is often blocked outright, so a plain
     "google failed" message left the shopkeeper with no way in. The honest
     answer is the whole-page route: leave for Google, come back signed in. */
  const fb = fakeFirebase({ googleBlocked: true });
  const Auth = loadAuth(fb);
  let err = null;
  try { await Auth.loginWithGoogle(); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.googleRedirect', 'it says it is taking you to Google');
  assert.strictEqual(fb._calls.redirect.length, 1, 'the redirect really was opened');
  assert.ok(!Auth.isLoggedIn(), 'not signed in yet — the page is leaving');
});

test('coming back from Google signs the shop in', async () => {
  const fb = fakeFirebase({ redirectUser: { uid: 'ug9', email: 'back@shop.tn', displayName: 'Back Boss' } });
  const Auth = loadAuth(fb);
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(fb._calls.redirectResult.length, 1, 'boot asked Firebase for the redirect result');
  assert.ok(Auth.isLoggedIn(), 'the returning shopkeeper is signed in');
  assert.strictEqual(Auth.getUser().email, 'back@shop.tn');
});

test('loginWithGoogle: an address Firebase does not know is named honestly, not as a wrong password', async () => {
  const fb = fakeFirebase({ domainBlocked: true });
  const Auth = loadAuth(fb);
  let err = null;
  try { await Auth.loginWithGoogle(); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.domain', 'auth/unauthorized-domain names the address, not the account');
});

test('loginWithGoogle: without the Firebase SDK nothing pops up — same google key', async () => {
  const Auth = loadAuth(null);
  let err = null;
  try { await Auth.loginWithGoogle(); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.google');
});