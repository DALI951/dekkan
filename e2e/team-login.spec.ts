/* DEKKAN E2E — THE SHOP'S OWN DOOR (wave 6).
 *
 * Dali, 2026-10-12: "a cashier get logged in he see only the caisse until the
 * manager come in and open ... it require a name and password for user, no
 * google sign in in this and its required ... the account get created when the
 * employee is created".
 *
 * So this spec drives a real counter: hire a manager, hand the tablet over by
 * signing in as a cashier, and prove that
 *   - a shop with no user still opens straight into the till (nobody is ambushed);
 *   - the hire and his login are one action;
 *   - a cashier lands on the till and CANNOT reach anything else (the tabs are
 *     gone, and a typed address bounces back to the caisse);
 *   - the manager types his own credentials and the whole shop opens;
 *   - a wrong password is refused, and a cashier can never open the shop;
 *   - the login lasts the TAB (a reload keeps it), and locking brings it back.
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, seedLang } = require('./helpers');

// English UI, so the spec can read the refusal messages it asserts on.
test.beforeEach(async ({ context }) => { await seedLang(context, 'en'); });

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

/* the rail is a sidebar on a PC and a top strip on a phone — the same tab must
   be found either way, so ask for ANY button with that address */
const tab = (page, hash) => page.locator('button[data-hash="' + hash + '"]').first();
const tabOn = (page, hash) => page.locator('button[data-hash="' + hash + '"]:visible').first();
const chip = page => page.locator('.userchip:visible').first();

async function hire(page, name, role, user, pass) {
  await page.locator('#btnAddEmployee').click();
  await page.locator('#empName').fill(name);
  await page.locator('#empType').fill('Cashier');
  await page.locator('#empSalary').fill('400');
  await page.locator('#empRole').selectOption(role);
  await page.locator('#empUser').fill(user);
  await page.locator('#empPass').fill(pass);
  await page.locator('#btnSaveEmployee').click();
  /* the password is really hashed (PBKDF2) — the hire lands a moment later */
  await expect(page.locator('#staffList')).toContainText(user, { timeout: 15000 });
}

/* the door, wherever it is offered: the boot wall, or the chip's own button */
async function openDoor(page) {
  if (!(await page.locator('#shopGate').isVisible())) {
    await page.locator('[data-action="shop-signin"]:visible').first().click();
  }
  await expect(page.locator('#shopGate')).toBeVisible();
}

async function signIn(page, user, pass) {
  await openDoor(page);
  await page.locator('#shopUser').fill(user);
  await page.locator('#shopPass').fill(pass);
  await page.locator('#shopEnter').click();
  await expect(page.locator('#shopGate')).toBeHidden({ timeout: 15000 });
}

/* a fresh browser, exactly as the cashier finds it in the morning: the tab's
   session is gone (that is what closing the browser does) and the app boots
   from scratch — a hash change alone would NOT reload the page */
async function freshBrowser(page, hash) {
  await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
  await page.goto('about:blank');
  await page.goto('/' + (hash || '#/sell'));
  await page.waitForLoadState('domcontentloaded');
}

/* one manager (Sami) on the payroll, signed in at the till */
async function shopWithManager(page) {
  await open(page, '#/employees');
  await hire(page, 'Sami', 'manager', 'sami', 'sh0p1234');
  await signIn(page, 'sami', 'sh0p1234');
}

test('a shop with no user at all opens straight into the till (nobody is ambushed)', async ({ page }) => {
  await open(page, '#/sell');
  await expect(page.locator('#shopGate')).toBeHidden();
  await expect(page.locator('#page-sell')).toBeVisible();
  await expect(tabOn(page, '#/settings')).toBeVisible();
  await expect(page.locator('.userchip').first()).toBeHidden();
});

test('the hire and his login are one action, and a cashier sees the caisse only', async ({ page }) => {
  await shopWithManager(page);
  await hire(page, 'Hedi', 'cashier', 'hedi', 'caisse123');

  /* both logins are listed beside their owner, with the role */
  await expect(page.locator('#staffList')).toContainText('sami');
  await expect(page.locator('#staffList')).toContainText('hedi');

  /* the cashier takes over: nobody signed in, so the shop asks who is there */
  await freshBrowser(page, '#/sell');
  await expect(page.locator('#shopGate')).toBeVisible();
  await expect(page.locator('#shopGateTitle')).toContainText('sign-in');
  await signIn(page, 'hedi', 'caisse123');

  /* the caisse, and nothing else */
  await expect(page.locator('#page-sell')).toBeVisible();
  await expect(tabOn(page, '#/sell')).toBeVisible();
  await expect(tab(page, '#/stock')).toBeHidden();
  await expect(tab(page, '#/employees')).toBeHidden();
  await expect(tab(page, '#/settings')).toBeHidden();
  await expect(chip(page)).toContainText('Hedi');
  await expect(chip(page)).toContainText('Cashier');

  /* a typed address cannot open what the role may not see */
  await page.goto('/#/settings');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#page-sell')).toBeVisible();
  await expect(page.locator('#page-settings')).toBeHidden();
});

test('the manager comes in and opens the whole shop', async ({ page }) => {
  await shopWithManager(page);
  await hire(page, 'Hedi', 'cashier', 'hedi', 'caisse123');
  await freshBrowser(page, '#/sell');
  await signIn(page, 'hedi', 'caisse123');
  await expect(tab(page, '#/stock')).toBeHidden();

  /* the cashier's chip carries the manager's way in */
  await page.locator('[data-action="shop-unlock"]:visible').first().click();
  await expect(page.locator('#shopGate')).toBeVisible();
  await expect(page.locator('#shopGateTitle')).toContainText('manager');

  await page.locator('#shopUser').fill('sami');
  await page.locator('#shopPass').fill('sh0p1234');
  await page.locator('#shopEnter').click();
  await expect(page.locator('#shopGate')).toBeHidden({ timeout: 15000 });

  await expect(tabOn(page, '#/sell')).toBeVisible();
  await expect(tabOn(page, '#/stock')).toBeVisible();
  await expect(tabOn(page, '#/employees')).toBeVisible();
  await expect(chip(page)).toContainText('Sami');
  await expect(chip(page)).toContainText('Manager');
});

test('a wrong password is refused, and a cashier can never open the shop', async ({ page }) => {
  await shopWithManager(page);
  await hire(page, 'Hedi', 'cashier', 'hedi', 'caisse123');
  await freshBrowser(page, '#/sell');

  /* wrong password: the door says no and stays shut */
  await openDoor(page);
  await page.locator('#shopUser').fill('hedi');
  await page.locator('#shopPass').fill('wrong-one');
  await page.locator('#shopEnter').click();
  await expect(page.locator('#shopGateError')).toBeVisible();
  await expect(page.locator('#shopGateError')).toContainText('Wrong name or password');
  await expect(page.locator('#shopGate')).toBeVisible();

  /* the right cashier password opens the till... */
  await signIn(page, 'hedi', 'caisse123');

  /* ...but the manager's door will not take a cashier's credentials */
  await page.locator('[data-action="shop-unlock"]:visible').first().click();
  await page.locator('#shopUser').fill('hedi');
  await page.locator('#shopPass').fill('caisse123');
  await page.locator('#shopEnter').click();
  await expect(page.locator('#shopGateError')).toContainText('cashier');
  await expect(page.locator('#shopGate')).toBeVisible();
  await expect(tab(page, '#/settings')).toBeHidden();
});

test('the login lasts the tab, and locking the shop brings the door back', async ({ page }) => {
  await shopWithManager(page);
  await expect(chip(page)).toContainText('Sami');
  await expect(chip(page)).toContainText('Manager');
  await tabOn(page, '#/sell').click();
  await expect(page.locator('#page-sell')).toBeVisible();

  /* same tab, same day: a reload does not ask again (sessionStorage) */
  await page.reload();
  await expect(page.locator('#shopGate')).toBeHidden();
  await expect(page.locator('#page-sell')).toBeVisible();

  /* and the shop can be closed again — the door comes back */
  await page.locator('[data-action="shop-lock"]:visible').first().click();
  await expect(page.locator('#shopGate')).toBeVisible();
  await expect(page.locator('#shopGateTitle')).toContainText('sign-in');
});
