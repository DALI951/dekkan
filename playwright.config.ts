/* DEKKAN E2E — real-browser tests that drive the app like a human.
 * Two projects: desktop (sidebar) and phone (topbar + topnav) — dekkan is
 * phone-first, so both layouts get the same user journeys.
 * Run: npm run test:e2e
 */
'use strict';
const { defineConfig, devices } = require('@playwright/test');

// DEKKAN_BASE_URL=... npm run test:e2e  -> run the same battery against the
// LIVE site instead of the local server. Same tests, production.
const LOCAL = 'http://127.0.0.1:4173';
const BASE = process.env.DEKKAN_BASE_URL || LOCAL;

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1, // one browser at a time — the app is tiny, the machine isn't always
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    headless: true,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'PC', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'Phone', use: { ...devices['Pixel 5'] } }
  ],
  // only boot the local server when we are actually testing locally
  ...(BASE === LOCAL
    ? {
        webServer: {
          command: 'node scripts/serve.js 4173',
          url: LOCAL,
          reuseExistingServer: true,
          timeout: 30000
        }
      }
    : {})
});