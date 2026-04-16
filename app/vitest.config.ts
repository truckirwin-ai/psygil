import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/main/**/__tests__/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    // Increase timeout for integration tests
    testTimeout: 30_000,
    // Setup file to mock Electron APIs
    setupFiles: ['src/main/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      electron: 'src/main/__tests__/mocks/electron.ts',
    },
  },
})
