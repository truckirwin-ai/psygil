/**
 * Global test setup for Psygil tests.
 * Mocks Electron APIs and injects in-memory database.
 */

import { vi, beforeEach, beforeAll } from 'vitest'
import { getTestDb, resetTestDb, initializeTestDb } from './test-db'

/**
 * Initialize test database before any tests run.
 */
beforeAll(async () => {
  await initializeTestDb()
})

/**
 * Mock the db/connection module to return our in-memory test database.
 */
vi.mock('../db/connection', () => ({
  getSqlite: () => getTestDb(),
  getDb: () => null,
  initDb: vi.fn(),
}))

/**
 * Mock the workspace module to return a test workspace path.
 */
vi.mock('../workspace', () => ({
  loadWorkspacePath: () => '/tmp/psygil-test-workspace',
  watchWorkspace: vi.fn(),
  stopWatcher: vi.fn(),
  syncWorkspaceToDB: vi.fn(),
}))

/**
 * Mock Electron APIs (app, BrowserWindow, ipcMain, dialog, safeStorage).
 */
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/psygil-test'),
    isReady: vi.fn(() => true),
  },
  BrowserWindow: vi.fn(),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
}))

/**
 * Mock fs operations (used by documents, cases, etc.)
 */
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    mkdirSync: vi.fn(),
    existsSync: vi.fn(() => true),
    renameSync: vi.fn(),
    copyFileSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn(() => ({ size: 1024 })),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(() => []),
  }
})

/**
 * Reset test database before each test.
 */
beforeEach(() => {
  resetTestDb()
})
