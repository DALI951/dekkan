// @ts-nocheck
// JS -> TS migration (first pass): this file is the dynamic DOM / service-worker /
// vm-harness layer (loose globals + event targets). Types get tightened incrementally.
/* DEKKAN auth tests — the account layer (js/auth.js) on FIREBASE, in isolation.
 * A deterministic fake Firebase (test/fake-firebase.js) stands in for the
 * compat SDK: the specs below pin the DECISIONS auth.js makes (validation,
 * error mapping, session, the cloud blob), not Google's transport.
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

// ---------- register ----------

test('register: creates the Firebase user, saves the shop name to the profile and logs in', async () => {
  const fb = fakeFirebase({});
  const Auth = loadAuth(fb);
  const user = await Auth.register('a@b.c', 'secret1', 'Shop');
  assert.strictEqual(user.email, 'a@b.c');
  assert.strictEqual(user.shopName, 'Shop');
  assert.strictEqual(fb._calls.register.length, 1, 'the fake auth got one createUser call');
  assert.strictEqual(fb._calls.register[0].email, 'a@b.c');
  assert.strictEqual(fb._calls.register[0].password, 'secret1');
  assert.deepStrictEqual(fb._calls.update[0], { displayName: 'Shop' }, 'shop name goes to the profile');
  assert.ok(Auth.isLoggedIn(), 'register logs you in');
  assert.strictEqual(Auth.getUser().id, fb._state.user.uid, 'the session carries the firebase uid');
});

test('register: invalid email / short password / short shop name are refused BEFORE any call', async () => {
  const fb = fakeFirebase({});
  const Auth = loadAuth(fb);
  for (const bad of [
    ['not-an-email', 'secret1', 'Shop'],
    ['a@b.c', '1234', 'Shop'],
    ['a@b.c', 'secret1', 'S']
  ]) {
    let err = null;
    try { await Auth.register(bad[0], bad[1], bad[2]); } catch (e) { err = e; }
    assert.ok(err, 'register with ' + JSON.stringify(bad) + ' must throw');
    assert.ok(err.code && err.code.indexOf('auth.err.') === 0, 'throws an i18n key, got ' + err.code);
  }
  assert.strictEqual(fb._calls.register.length, 0, 'no user created for bad input');
});

test('register: an email that exists surfaces as email taken', async () => {
  const fb = fakeFirebase({ knownEmails: ['taken@shop.tn'] });
  const Auth = loadAuth(fb);
  let err = null;
  try { await Auth.register('taken@shop.tn', 'secret1', 'Shop'); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.emailTaken');
  assert.ok(!Auth.isLoggedIn(), 'failed register leaves you logged out');
});

// ---------- login ----------

test('login: signs in with email + password and maps the user', async () => {
  const fb = fakeFirebase({ acceptLogin: true, user: { uid: 'u7', email: 'boss@shop.tn', displayName: 'Test Shop' } });
  const Auth = loadAuth(fb);
  const user = await Auth.login('boss@shop.tn', 'secret1');
  assert.strictEqual(user.email, 'boss@shop.tn');
  assert.ok(Auth.isLoggedIn());
});

test('login: wrong credentials throw the friendly key and do NOT log in', async () => {
  const fb = fakeFirebase({}); // acceptLogin unset -> the fake rejects
  const Auth = loadAuth(fb);
  let err = null;
  try { await Auth.login('a@b.c', 'nope'); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.badCredentials');
  assert.ok(!Auth.isLoggedIn(), 'failed login leaves you logged out');
});

test('login: an invalid email is refused before any network call', async () => {
  const fb = fakeFirebase({});
  const Auth = loadAuth(fb);
  let err = null;
  try { await Auth.login('not-an-email', 'secret1'); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.invalidEmail');
  assert.strictEqual(fb._calls.login.length, 0, 'no sign-in attempt for a malformed email');
});

// ---------- session restore ----------

test('a saved session is restored by the SDK: ready() resolves signed in', async () => {
  const fb = fakeFirebase({ user: { uid: 'u7', email: 'boss@shop.tn', displayName: 'Test Shop' } });
  const Auth = loadAuth(fb);
  await Auth.ready();
  assert.ok(Auth.isLoggedIn(), 'the restored session counts as signed in');
  assert.strictEqual(Auth.getUser().shopName, 'Test Shop');
});

test('no SDK at all (no window.firebase): honest offline, never a crash', async () => {
  const Auth = loadAuth(null); // window has no DEKKAN_FIREBASE / firebase
  await Auth.ready();
  assert.ok(!Auth.isLoggedIn());
  let err = null;
  try { await Auth.register('a@b.c', 'secret1', 'Shop'); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.server', 'online + no SDK = the cloud layer is down');
  assert.strictEqual(await Auth.fetchState(), null, 'fetchState resolves null, not a throw');
  assert.strictEqual(await Auth.pushState({ x: 1 }), false, 'pushState resolves false, not a throw');
});

test('no SDK + offline: the honest reason is offline', async () => {
  setOnline(false);
  try {
    const Auth = loadAuth(null);
    await Auth.ready();
    let err = null;
    try { await Auth.register('a@b.c', 'secret1', 'Shop'); } catch (e) { err = e; }
    assert.strictEqual(err && err.code, 'auth.err.offline');
  } finally {
    setOnline(true);
  }
});

// ---------- logout ----------

test('logout: clears the session and tells Firebase', async () => {
  const fb = fakeFirebase({ user: { uid: 'u7', email: 'boss@shop.tn', displayName: 'Test Shop' } });
  const Auth = loadAuth(fb);
  await Auth.ready();
  assert.ok(Auth.isLoggedIn());
  await Auth.logout();
  assert.ok(!Auth.isLoggedIn(), 'local session cleared');
  assert.strictEqual(fb._calls.logout.length, 1, 'firebase signOut was called');
  assert.strictEqual(fb._state.user, null);
});

// ---------- the cloud state blob ----------

test('pushState: writes the whole state as one JSON string to shops/{uid}', async () => {
  const fb = fakeFirebase({ user: { uid: 'u7', email: 'boss@shop.tn', displayName: 'Test Shop' } });
  const Auth = loadAuth(fb);
  await Auth.ready();
  const state = { shop: { name: 'S' }, days: [] };
  const ok = await Auth.pushState(state);
  assert.strictEqual(ok, true);
  const setCall = fb._calls.set[0];
  assert.ok(setCall, 'a firestore set happened');
  assert.strictEqual(setCall.path, 'shops/u7');
  assert.deepStrictEqual(JSON.parse(setCall.obj.data), state, 'state goes up verbatim');
  assert.ok(setCall.obj.updatedAt, 'a timestamp rides along');
});

test('pushState is refused when no account is live', async () => {
  const fb = fakeFirebase({});
  const Auth = loadAuth(fb);
  await Auth.ready();
  assert.strictEqual(await Auth.pushState({ x: 1 }), false);
  assert.strictEqual(fb._calls.set.length, 0, 'nothing written without a session');
});

test('fetchState: a saved copy comes back parsed; a missing doc is null', async () => {
  const state = { shop: { name: 'S' }, days: [] };
  const fb = fakeFirebase({ user: { uid: 'u7', email: 'boss@shop.tn', displayName: 'Test Shop' }, docs: { 'shops/u7': JSON.stringify(state) } });
  const Auth = loadAuth(fb);
  await Auth.ready();
  assert.deepStrictEqual(await Auth.fetchState(), state, 'the blob round-trips');
  const fb2 = fakeFirebase({ user: { uid: 'u7', email: 'boss@shop.tn', displayName: 'Test Shop' } });
  const Auth2 = loadAuth(fb2);
  await Auth2.ready();
  assert.strictEqual(await Auth2.fetchState(), null, 'no doc = no state yet');
});

test('fetchState: a dead network says offline and keeps the local copy', async () => {
  setOnline(false);
  try {
    const fb = fakeFirebase({ user: { uid: 'u7', email: 'boss@shop.tn', displayName: 'Test Shop' }, failGet: true });
    const Auth = loadAuth(fb);
    await Auth.ready();
    assert.strictEqual(await Auth.fetchState(), null, 'returns null, not a throw');
    assert.strictEqual(Auth.syncError(), 'offline', 'and names the honest reason');
  } finally {
    setOnline(true);
  }
});