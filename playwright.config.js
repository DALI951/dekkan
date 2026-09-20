/* DEKKAN E2E — real-browser tests that drive the app like a human.
 * Two projects: desktop (sidebar) and phone (topbar + topnav) — dekkan is
 * phone-first, so both layouts get the same user journeys.
 * Run: npm run test:e2e
 */
'use strict';
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1, // one browser at a time — the app is tiny, the machine isn't always
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'PC', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'Phone', use: { ...devices['Pixel 5'] } }
  ],
  webServer: {
    command: 'node scripts/serve.js 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30000
  }
});