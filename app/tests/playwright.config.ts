/**
 * Playwright config for Electron e2e, a11y, and visual regression specs.
 */

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'a11y/**/*.spec.ts', 'visual/**/*.spec.ts'],
  timeout: 60_000,
  fullyParallel: false, // Electron app sessions are not safe to run in parallel against shared workspace.
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'test-results/html' }], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
