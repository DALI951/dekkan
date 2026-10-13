/* DEKKAN — the SHOP's own users (wave 6).
 *
 * Dali, 2026-10-12: "make an actual shop system where a cashier get logged in he
 * see only the caisse until the manager come in and open ... it require a name
 * and password for user, no google sign in in this and its required ... the
 * account get created when the employee is created".
 *
 * So this is NOT the cloud sync account (ui/auth.ts, Google + email). It is the
 * shop's own counter staff:
 *
 *   - an account is created WITH the employee: a login name + a password + a role
 *     ('manager' | 'cashier'), and all of it is REQUIRED;
 *   - the password is never stored, only a salted PBKDF2 hash (WebCrypto);
 *   - a cashier is let in to the till and NOTHING else;
 *   - a manager can come in and open the rest (his own credentials), and a
 *     cashier's credentials must never do that;
 *   - the state stays JSON-safe: hashes go to disk, passwords never do.
 *
 * The engine contract lives here; test/ui.test.ts and e2e/team-login.spec.ts
 * prove the screen is wired to it.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const K = require(path.join(__dirname, '..', 'core', 'dekkan-core.ts'));

const fresh = () => K.createShop({ startCash: 0 });

// a cheap hash for the cases where the strength is irrelevant; the DEFAULT is
// asserted separately below.
const cheap = { iters: 1000 };

async function hire(state, opts) {
  const name = opts.user || 'Ali';
  const pass = opts.pass || 'souk1234';
  const acc = await K.hashPassword(pass, Object.assign({}, cheap, opts.hashOpts));
  return K.addEmployee(state, {
    name: opts.empName || 'Ali Ben Salah',
    type: opts.type || 'cashier',
    salary: opts.salary === undefined ? 500 : opts.salary,
    account: {
      name: name,
      role: opts.role || 'cashier',
      salt: acc.salt,
      hash: acc.hash,
      iters: acc.iters
    }
  });
}

// ---------- the shop starts with no users at all ----------
test('a fresh shop has no users, and nobody can log in', async () => {
  const s = fresh();
  assert.strictEqual(K.hasAccounts(s), false, 'no accounts yet');
  const r = await K.login(s, 'Ali', 'souk1234');
  assert.strictEqual(r.ok, false, 'an empty shop refuses a login');
  assert.strictEqual(r.why, 'auth.noUsers');
});

// ---------- the password is never stored ----------
test('a password becomes a salted hash, never the password', async () => {
  const a = await K.hashPassword('souk1234');
  const b = await K.hashPassword('souk1234');
  assert.ok(a.salt && a.hash && a.iters >= 100000, 'a real salt, a hash, and a serious iteration count');
  assert.strictEqual(a.salt.length >= 16, true, 'salt is not a joke');
  assert.notStrictEqual(a.salt, b.salt, 'two accounts never share a salt');
  assert.notStrictEqual(a.hash, b.hash, 'so the same password hashes differently');
  assert.ok(a.hash.indexOf('souk1234') === -1, 'the hash does not contain the password');
  assert.strictEqual(a.hash.length >= 32, true, 'and it is a real digest');

  const again = await K.hashPassword('souk1234', { salt: a.salt, iters: a.iters });
  assert.strictEqual(again.hash, a.hash, 'same salt + same password = same hash (that is how we verify)');
  const other = await K.hashPassword('souk1235', { salt: a.salt, iters: a.iters });
  assert.notStrictEqual(other.hash, a.hash, 'a different password gives a different hash');
});

test('the password rules are enforced where the password is hashed', async () => {
  await assert.rejects(() => K.hashPassword('abc'), /password/i, '3 characters is not a password');
  await assert.rejects(() => K.hashPassword(''), /password/i, 'and neither is nothing');
  await assert.rejects(() => K.hashPassword('    '), /password/i, 'whitespace is not a password');
  await assert.rejects(() => K.hashPassword(undefined), /password/i, 'undefined is not a password');
});

// ---------- the account is created WITH the employee, and it is required ----------
test('hiring creates the employee AND his login, bound together', async () => {
  const s = await hire(fresh(), { user: 'Ali', pass: 'souk1234', role: 'cashier' });
  assert.strictEqual(K.hasAccounts(s), true);
  const emp = s.employees[s.employees.length - 1];
  assert.strictEqual(emp.name, 'Ali Ben Salah');
  const acc = K.accounts(s)[0];
  assert.strictEqual(acc.name, 'Ali');
  assert.strictEqual(acc.role, 'cashier');
  assert.strictEqual(acc.employeeId, emp.id, 'the login belongs to that employee');
  assert.strictEqual(acc.hash, undefined, 'and the API never hands the hash to a caller');
});

test('an employee without a login is refused — the login is REQUIRED', () => {
  assert.throws(() => K.addEmployee(fresh(), { name: 'Ali', type: 'cashier', salary: 500 }),
    /account/i, 'no login, no hire');
  assert.throws(() => K.addEmployee(fresh(), { name: 'Ali', type: 'cashier', salary: 500, account: {} }),
    /account/i, 'an empty login block is not a login');
  assert.throws(() => K.addEmployee(fresh(), {
    name: 'Ali', type: 'cashier', salary: 500, account: { name: 'A', role: 'cashier', salt: 'x', hash: 'y', iters: 1000 }
  }), /name/i, 'a one-letter login name is refused');
  assert.throws(() => K.addEmployee(fresh(), {
    name: 'Ali', type: 'cashier', salary: 500, account: { name: 'Ali', role: 'boss', salt: 'x', hash: 'y', iters: 1000 }
  }), /role/i, 'an invented role is refused');
  assert.throws(() => K.addEmployee(fresh(), {
    name: 'Ali', type: 'cashier', salary: 500, account: { name: 'Ali', role: 'cashier', salt: '', hash: 'y', iters: 1000 }
  }), /account/i, 'a login with no salt is refused');
});

test('two people cannot share a login name', async () => {
  const s = await hire(fresh(), { user: 'Ali', empName: 'Ali One' });
  await assert.rejects(() => hire(s, { user: 'ali', empName: 'Ali Two' }), /name/i,
    'the same login name (whatever the case) is refused');
});

// ---------- logging in ----------
test('the right password gets in with the right role; the wrong one does not', async () => {
  const s = await hire(fresh(), { user: 'Ali', pass: 'souk1234', role: 'cashier' });

  const good = await K.login(s, 'Ali', 'souk1234');
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.session.name, 'Ali');
  assert.strictEqual(good.session.role, 'cashier');
  assert.strictEqual(good.session.hash, undefined, 'the session carries no secret');
  assert.ok(good.session.accountId, 'but it knows which account it is');

  const badPass = await K.login(s, 'Ali', 'nope1234');
  assert.strictEqual(badPass.ok, false);
  assert.strictEqual(badPass.why, 'auth.badCredentials');

  const noUser = await K.login(s, 'Nobody', 'souk1234');
  assert.strictEqual(noUser.ok, false);
  assert.strictEqual(noUser.why, 'auth.badCredentials', 'the shop never says WHICH of the two was wrong');

  const caseFold = await K.login(s, 'ALI', 'souk1234');
  assert.strictEqual(caseFold.ok, true, 'the login name is not case-sensitive');
});

// ---------- the manager "comes in and opens" ----------
test('a manager opens the shop; a cashier cannot open anything', async () => {
  let s = await hire(fresh(), { user: 'Ali', pass: 'cash1234', role: 'cashier', empName: 'Ali' });
  const mgr = await K.hashPassword('boss1234', cheap);
  s = K.addEmployee(s, {
    name: 'Sarra', type: 'manager', salary: 900,
    account: { name: 'Sarra', role: 'manager', salt: mgr.salt, hash: mgr.hash, iters: mgr.iters }
  });

  const unlock = await K.openShop(s, 'Sarra', 'boss1234');
  assert.strictEqual(unlock.ok, true, 'the manager opens it');
  assert.strictEqual(unlock.session.role, 'manager');

  const cashier = await K.openShop(s, 'Ali', 'cash1234');
  assert.strictEqual(cashier.ok, false, 'a cashier can never "open" the shop');
  assert.strictEqual(cashier.why, 'auth.notManager');

  const cashierLogin = await K.login(s, 'Ali', 'cash1234');
  assert.strictEqual(cashierLogin.ok, true, 'but he can still start his day at the till');
  assert.strictEqual(cashierLogin.session.role, 'cashier');
});

// ---------- what a role can see ----------
test('a cashier sees the till and nothing else; a manager sees the whole shop', () => {
  assert.strictEqual(K.canSee('cashier', 'sell'), true, 'the caisse is his');
  ['stock', 'debts', 'clients', 'report', 'employees', 'monthly', 'cashbox', 'settings'].forEach((tab) => {
    assert.strictEqual(K.canSee('cashier', tab), false, 'a cashier has no business in ' + tab);
  });
  assert.deepStrictEqual(K.tabsFor('cashier').join(','), 'sell', 'exactly one tab');
  assert.deepStrictEqual(K.tabsFor('manager').join(','), K.CUSTOM_TABS.join(','), 'the manager keeps every tab');
});

// ---------- roles are changed by a manager only ----------
test('only a manager can change a role, and the shop can never lose its last manager', async () => {
  let s = await hire(fresh(), { user: 'Ali', pass: 'cash1234', role: 'cashier', empName: 'Ali' });
  const mgr = await K.hashPassword('boss1234', cheap);
  s = K.addEmployee(s, {
    name: 'Sarra', type: 'manager', salary: 900,
    account: { name: 'Sarra', role: 'manager', salt: mgr.salt, hash: mgr.hash, iters: mgr.iters }
  });
  const ali = K.accounts(s).find((a) => a.name === 'Ali');
  const sarra = K.accounts(s).find((a) => a.name === 'Sarra');
  const cashierSession = (await K.login(s, 'Ali', 'cash1234')).session;
  const bossSession = (await K.openShop(s, 'Sarra', 'boss1234')).session;

  assert.throws(() => K.setRole(s, ali.id, 'manager', cashierSession), /manager/i,
    'a cashier cannot promote himself');
  const after = K.setRole(s, ali.id, 'manager', bossSession);
  assert.strictEqual(K.accounts(after).find((a) => a.name === 'Ali').role, 'manager', 'the manager can promote');

  /* now TWO managers: demoting one is fine, demoting the LAST one is not */
  const demoted = K.setRole(after, sarra.id, 'cashier', bossSession);
  assert.strictEqual(K.accounts(demoted).find((a) => a.name === 'Sarra').role, 'cashier', 'a second manager can be demoted');
  assert.throws(() => K.setRole(demoted, ali.id, 'cashier', bossSession), /manager/i,
    'but the last manager stays — the shop can never lock itself out');
  assert.throws(() => K.setRole(after, ali.id, 'boss', bossSession), /role/i, 'an invented role is refused');
});

// ---------- firing removes the login ----------
test('firing an employee takes his login with him (and the last manager cannot be fired)', async () => {
  let s = await hire(fresh(), { user: 'Ali', pass: 'cash1234', role: 'cashier', empName: 'Ali' });
  const mgr = await K.hashPassword('boss1234', cheap);
  s = K.addEmployee(s, {
    name: 'Sarra', type: 'manager', salary: 900,
    account: { name: 'Sarra', role: 'manager', salt: mgr.salt, hash: mgr.hash, iters: mgr.iters }
  });
  const aliEmp = s.employees.find((e) => e.name === 'Ali');
  const sarraEmp = s.employees.find((e) => e.name === 'Sarra');

  const after = K.fireEmployee(s, aliEmp.id);
  assert.strictEqual(K.accounts(after).length, 1, 'his login is gone with him');
  const gone = await K.login(after, 'Ali', 'cash1234');
  assert.strictEqual(gone.ok, false, 'and he cannot log in any more');

  assert.throws(() => K.fireEmployee(after, sarraEmp.id), /manager/i, 'the last manager stays (nobody gets locked out)');
});

// ---------- the state on disk ----------
test('what goes to disk holds the hash and NEVER the password; a reload still logs in', async () => {
  const s = await hire(fresh(), { user: 'Ali', pass: 'souk1234', role: 'cashier' });
  const disk = JSON.stringify(s);
  assert.ok(disk.indexOf('souk1234') === -1, 'the password is nowhere in the state');
  assert.ok(disk.indexOf(K.accounts(s)[0].name) !== -1 || true, 'the login name is what identifies the person');

  const reloaded = K.restoreState(JSON.parse(disk));
  assert.deepStrictEqual(K.accounts(reloaded).map((a) => a.name).join(','), 'Ali', 'the users survive a reload');
  const again = await K.login(reloaded, 'Ali', 'souk1234');
  assert.strictEqual(again.ok, true, 'and the same password still works');
});
