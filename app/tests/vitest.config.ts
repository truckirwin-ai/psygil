/**
 * Vitest config for the Psygil test harness.
 * Covers unit, component, ipc, integration, a11y (node side), and perf.
 * E2E specs live alongside but run via Playwright, not Vitest.
 */

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.ts',
      'tests/component/**/*.test.tsx',
      'tests/ipc/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/perf/**/*.perf.ts',
    ],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
      exclude: ['tests/**', 'dist/**', '**/*.d.ts'],
    },
    setupFiles: ['tests/harness/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
