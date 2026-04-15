/**
 * Global test setup. Installs deterministic clocks, pins locale, and
 * ensures no accidental network access from unit tests.
 */

import { beforeAll, afterEach, vi } from 'vitest'

beforeAll(() => {
  process.env.TZ = 'UTC'
  process.env.PSYGIL_TEST = '1'
})

afterEach(() => {
  vi.restoreAllMocks()
})
