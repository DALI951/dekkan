/* DEKKAN auth tests — the account layer (js/auth.js) in isolation.
 * Stubs global.fetch + localStorage so register/login/logout and the
 * state push/pull can be proven without a server.
 * Run: node --test
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

// ---------- stubs ----------
function makeApi(mock) {
  const calls = [];
  const store = {};
  global.fetch = function (url, opts) {
    calls.push({ url: String(url), opts: opts || {} });
    const mockItem = mock(String(url), opts || {});
    return Promise.resolve({
      ok: !!mockItem.ok, status: mockItem.status || (mockItem.ok ? 200 : 500),
      json: () => Promise.resolve(mockItem.body)
    });
  };
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  return { calls, store };
}

const loadAuth = () => {
  delete require.cache[require.resolve('../js/auth.js')];
  const Auth = require('../js/auth.js').Auth;
  Auth.init(); // a fresh module starts with an empty session — the app calls init() at boot
  return Auth;
};

// ---------- the battery ----------
test('register: posts to auth.php?action=register and stores the session', async () => {
  const { calls, store } = makeApi(url => url.indexOf('action=register') !== -1
    ? { ok: true, body: { ok: true, token: 't'.repeat(64), user: { id: 1, email: 'a@b.c', shopName: 'S' } } }
    : { ok: false, status: 404, body: {} });
  const Auth = loadAuth();
  const user = await Auth.register('a@b.c', 'secret1', 'Shop');
  assert.strictEqual(user.id, 1);
  const c = calls.find(x => x.url.indexOf('auth.php') !== -1);
  assert.ok(c, 'auth endpoint was called');
  const sent = JSON.parse(c.opts.body);
  assert.strictEqual(sent.email, 'a@b.c');
  assert.strictEqual(sent.password, 'secret1');
  assert.strictEqual(sent.shopName, 'Shop');
  assert.ok(Auth.isLoggedIn(), 'register logs you in');
  assert.strictEqual(store['dekkan.token'], 't'.repeat(64), 'token persisted');
});

test('login: wrong credentials throw with a lang key and do NOT log in', async () => {
  makeApi(url => url.indexOf('action=login') !== -1
    ? { ok: false, status: 401, body: { error: 'bad_credentials' } }
    : { ok: false, status: 404, body: {} });
  const Auth = loadAuth();
  let err = null;
  try { await Auth.login('a@b.c', 'nope'); } catch (e) { err = e; }
  assert.ok(err, 'login must throw on 401');
  assert.strictEqual(err.code, 'auth.err.badCredentials');
  assert.ok(!Auth.isLoggedIn(), 'failed login leaves you logged out');
});

test('login: server codes map to friendly keys', async () => {
  makeApi(url => url.indexOf('action=login') !== -1
    ? { ok: false, status: 401, body: { error: 'email_taken' } }
    : { ok: false, status: 404, body: {} });
  const Auth = loadAuth();
  let err = null;
  try { await Auth.login('a@b.c', 'nope'); } catch (e) { err = e; }
  assert.strictEqual(err.code, 'auth.err.emailTaken');
});

test('logout: clears the local session and tells the server', async () => {
  const { calls, store } = makeApi(url => url.indexOf('action=logout') !== -1
    ? { ok: true, body: { ok: true } }
    : { ok: false, status: 404, body: {} });
  store['dekkan.token'] = 't'.repeat(64);
  store['dekkan.user'] = JSON.stringify({ id: 1, email: 'a@b.c', shopName: 'S' });
  const Auth = loadAuth();
  await Auth.logout();
  const c = calls.find(x => x.url.indexOf('action=logout') !== -1);
  assert.ok(c, 'logout endpoint was called');
  assert.strictEqual(c.opts.headers.Authorization, 'Bearer ' + 't'.repeat(64));
  assert.ok(!Auth.isLoggedIn(), 'local session cleared');
  assert.strictEqual(store['dekkan.token'], undefined);
});

test('pushState: PUTs the raw state JSON with the token header', async () => {
  const { calls } = makeApi(url => url.indexOf('state.php') !== -1
    ? { ok: true, body: { ok: true } }
    : { ok: false, status: 404, body: {} });
  const Auth = loadAuth();
  Auth.init();
  Auth.setCredentials('tok123', { id: 1, email: 'a@b.c', shopName: 'S' });
  const state = { shop: { name: 'S' }, days: [] };
  const ok = await Auth.pushState(state);
  assert.strictEqual(ok, true);
  const c = calls.find(x => x.url.indexOf('state.php') !== -1);
  assert.ok(c, 'state endpoint was called');
  assert.strictEqual(c.opts.method, 'PUT');
  assert.strictEqual(c.opts.headers.Authorization, 'Bearer tok123');
  assert.strictEqual(JSON.parse(c.opts.body).shop.name, 'S', 'state goes up verbatim');
});

test('fetchState: 404 means no saved state yet (returns null)', async () => {
  makeApi(url => url.indexOf('state.php') !== -1
    ? { ok: false, status: 404, body: { error: 'no_state' } }
    : { ok: false, status: 404, body: {} });
  const Auth = loadAuth();
  Auth.init();
  Auth.setCredentials('tok123', { id: 1, email: 'a@b.c', shopName: 'S' });
  const s = await Auth.fetchState();
  assert.strictEqual(s, null);
});

test('fetchState: a saved state comes back parsed; 401 logs you out', async () => {
  let n = 0;
  const { store } = makeApi(url => url.indexOf('state.php') !== -1
    ? (n++ === 0
      ? { ok: true, body: { shop: { name: 'Cloud' }, days: [] } }
      : { ok: false, status: 401, body: { error: 'invalid_token' } })
    : { ok: false, status: 404, body: {} });
  store['dekkan.token'] = 't'.repeat(64);
  store['dekkan.user'] = JSON.stringify({ id: 1, email: 'a@b.c', shopName: 'S' });
  const Auth = loadAuth();
  const s = await Auth.fetchState();
  assert.strictEqual(s.shop.name, 'Cloud', 'pull parses the stored JSON');
  const s2 = await Auth.fetchState();
  assert.strictEqual(s2, null);
  assert.ok(!Auth.isLoggedIn(), '401 clears the dead session');
});

// ---------- honest failures (a shopkeeper must never blame the wrong thing) ----------

// the browser's navigator: what the app uses to tell "no signal" from "the
// server broke". Node ships one of its own, so it has to be swapped for a plain object.
function setOnline(onLine) {
  Object.defineProperty(global, 'navigator', { value: { onLine: onLine }, configurable: true, writable: true });
}

test('no network: the failure says "offline", not "wrong password"', async () => {
  setOnline(false);
  global.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const Auth = loadAuth();
  let err = null;
  try { await Auth.login('a@b.c', 'whatever'); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.offline', 'he is told to check the connection');
  assert.ok(!Auth.isLoggedIn());
});

test('a broken server (500 / HTML / unknown code) says the SERVER is the problem', async () => {
  setOnline(true);
  const cases = [
    () => Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new SyntaxError('HTML')) }),
    () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'db_gone' }) }),
    () => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve(null) })
  ];
  for (const mk of cases) {
    global.fetch = mk;
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const Auth = loadAuth();
    let err = null;
    try { await Auth.login('a@b.c', 'whatever'); } catch (e) { err = e; }
    assert.strictEqual(err && err.code, 'auth.err.server', 'never blamed on his password');
  }
});

test('an expired session is REPORTED, not silently forgotten', async () => {
  const { store } = makeApi(url => url.indexOf('state.php') !== -1
    ? { ok: false, status: 401, body: { error: 'invalid_token' } }
    : { ok: false, status: 404, body: {} });
  store['dekkan.token'] = 't'.repeat(64);
  store['dekkan.user'] = JSON.stringify({ id: 1, email: 'a@b.c', shopName: 'S' });
  const Auth = loadAuth();
  const s = await Auth.fetchState();
  assert.strictEqual(s, null, 'no state came down');
  assert.ok(!Auth.isLoggedIn(), 'the dead session is dropped');
  assert.strictEqual(Auth.isExpired(), true, 'and the app is told WHY (so it can say so)');
});

test('a good login clears the expired flag', async () => {
  makeApi(url => url.indexOf('action=login') !== -1
    ? { ok: true, body: { ok: true, token: 'x'.repeat(64), user: { id: 1, email: 'a@b.c', shopName: 'S' } } }
    : { ok: false, status: 404, body: {} });
  const Auth = loadAuth();
  Auth.init();
  await Auth.login('a@b.c', 'secret1');
  assert.strictEqual(Auth.isExpired(), false);
});

test('pushState reports WHY it failed: offline vs server vs session', async () => {
  const scenarios = [
    [() => Promise.reject(new TypeError('Failed to fetch')), 'offline'],
    [() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'boom' }) }), 'server'],
    [() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'invalid_token' }) }), 'auth']
  ];
  for (const [mk, want] of scenarios) {
    setOnline(want !== 'offline');
    const store = {};
    global.localStorage = {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    };
    store['dekkan.token'] = 't'.repeat(64);
    store['dekkan.user'] = JSON.stringify({ id: 1, email: 'a@b.c', shopName: 'S' });
    global.fetch = mk;
    const Auth = loadAuth();
    const ok = await Auth.pushState({ shop: { name: 'S' }, days: [] });
    assert.strictEqual(ok, false);
    assert.strictEqual(Auth.syncError(), want, 'the settings page can tell the truth');
  }
});

test('a good push clears the sync error', async () => {
  const { store } = makeApi(url => url.indexOf('state.php') !== -1
    ? { ok: true, body: { ok: true } }
    : { ok: false, status: 404, body: {} });
  store['dekkan.token'] = 't'.repeat(64);
  store['dekkan.user'] = JSON.stringify({ id: 1, email: 'a@b.c', shopName: 'S' });
  const Auth = loadAuth();
  assert.strictEqual(await Auth.pushState({ a: 1 }), true);
  assert.strictEqual(Auth.syncError(), null);
});

test('init: restores a saved session from localStorage', () => {
  const { store } = makeApi(() => ({ ok: false, status: 404, body: {} }));
  store['dekkan.token'] = 't'.repeat(64);
  store['dekkan.user'] = JSON.stringify({ id: 3, email: 'x@y.z', shopName: 'Z' });
  const Auth = loadAuth();
  assert.ok(Auth.isLoggedIn(), 'init reads the token');
  assert.strictEqual(Auth.getUser().email, 'x@y.z');
});

test('client-side validation runs BEFORE any fetch; offline server never throws', async () => {
  let called = false;
  makeApi(url => { called = true; return { ok: true, body: { ok: true } }; });
  const Auth = loadAuth();
  let err = null;
  try { await Auth.register('not-an-email', 'short', 'S'); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.invalidEmail');
  try { await Auth.register('a@b.c', 'short', 'S'); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.shortPass');
  try { await Auth.register('a@b.c', '123456', ''); } catch (e) { err = e; }
  assert.strictEqual(err && err.code, 'auth.err.shortName');
  assert.strictEqual(called, false, 'no fetch happened for rejected input');
  // fetch undefined => everything resolves safely (offline-first app)
  delete global.fetch;
  const got = await Auth.pushState({ a: 1 });
  assert.strictEqual(got, false);
});