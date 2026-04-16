/**
 * Unit tests for src/main/uninstall/index.ts (Phase C.3).
 *
 * Coverage:
 *   1. Confirmation mismatch rejects before any destructive action.
 *   2. wipe_log writer produces valid JSON with all expected keys.
 *   3. Zero-fill (writeFileSync) happens BEFORE unlink for the DB file.
 *   4. safeStorage blobs and config files are removed.
 *
 * All fs calls and electron app are mocked so the suite runs outside Electron.
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import * as fs from 'fs'

// ---------------------------------------------------------------------------
// Mock electron so the module can be imported outside the Electron runtime
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}))

// Mock os to avoid "Cannot redefine property: userInfo" from native bindings
vi.mock('os', () => ({
  userInfo: vi.fn(() => ({ username: 'testuser', uid: 1000, gid: 1000, shell: '/bin/zsh', homedir: '/home/testuser' })),
  hostname: vi.fn(() => 'test-host'),
}))

// ---------------------------------------------------------------------------
// Mock the DB path resolver and workspace helpers
// ---------------------------------------------------------------------------

vi.mock('../../../src/main/db', () => ({
  getDefaultDbPath: vi.fn(() => '/mock/userData/psygil.db'),
}))

vi.mock('../../../src/main/db/connection', () => ({
  closeSqlite: vi.fn(),
}))

vi.mock('../../../src/main/workspace', () => ({
  loadWorkspacePath: vi.fn(() => '/mock/workspace/PsygilCases'),
  getDefaultWorkspacePath: vi.fn(() => '/mock/workspace/PsygilCases'),
}))

vi.mock('../../../src/main/audit', () => ({
  logAuditEntry: vi.fn(() => 1),
}))

// ---------------------------------------------------------------------------
// Mock fs selectively: existsSync returns true, statSync returns { size: 128 }
// writeFileSync and unlinkSync are spied on.
// ---------------------------------------------------------------------------

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: 128 })),
    readFileSync: vi.fn(() => '[]'),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const { wipeLocalData } = await import('../../../src/main/uninstall/index')
const { closeSqlite } = await import('../../../src/main/db/connection')

describe('wipeLocalData', () => {
  let writeFileSyncSpy: MockInstance
  let unlinkSyncSpy: MockInstance
  let existsSyncSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync')
    unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync')
    existsSyncSpy = vi.spyOn(fs, 'existsSync')
    existsSyncSpy.mockReturnValue(true)
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 128 } as fs.Stats)
    vi.spyOn(fs, 'readFileSync').mockReturnValue('[]')
  })

  // -------------------------------------------------------------------------
  // Test 1: Confirmation mismatch
  // -------------------------------------------------------------------------

  it('rejects with an error when confirmation does not match the workspace folder name', async () => {
    await expect(
      wipeLocalData('WrongName')
    ).rejects.toThrow(/Confirmation mismatch/)

    // No destructive calls should have happened
    expect(closeSqlite).not.toHaveBeenCalled()
    expect(unlinkSyncSpy).not.toHaveBeenCalled()
  })

  it('rejects even when confirmation is an empty string', async () => {
    await expect(
      wipeLocalData('')
    ).rejects.toThrow(/Confirmation mismatch/)
  })

  // -------------------------------------------------------------------------
  // Test 2: wipe_log writer produces valid JSON with all expected keys
  // -------------------------------------------------------------------------

  it('writes wipe_log.json with all required HIPAA accountability keys', async () => {
    // Stub readFileSync to return an empty array for the log file
    vi.spyOn(fs, 'readFileSync').mockReturnValue('[]')

    await wipeLocalData('PsygilCases')

    // Find the call that wrote to wipe_log.json
    const logWriteCall = writeFileSyncSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('wipe_log.json')
    )
    expect(logWriteCall).toBeDefined()

    const written = logWriteCall![1] as string
    const parsed: unknown[] = JSON.parse(written)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThanOrEqual(1)

    const entry = parsed[parsed.length - 1] as Record<string, unknown>
    expect(entry).toHaveProperty('timestamp')
    expect(entry).toHaveProperty('workspacePath')
    expect(entry).toHaveProperty('userId')
    expect(entry).toHaveProperty('hostname')
    expect(entry).toHaveProperty('pid')

    // Timestamp must be a valid ISO-8601 string
    expect(new Date(entry.timestamp as string).getTime()).not.toBeNaN()
  })

  // -------------------------------------------------------------------------
  // Test 3: zero-fill (writeFileSync) happens BEFORE unlink for DB file
  // -------------------------------------------------------------------------

  it('zero-fills the database file before unlinking it', async () => {
    const calls: string[] = []
    writeFileSyncSpy.mockImplementation((filePath: unknown) => {
      if (typeof filePath === 'string' && filePath.includes('psygil.db')) {
        calls.push('write:' + filePath)
      }
    })
    unlinkSyncSpy.mockImplementation((filePath: unknown) => {
      if (typeof filePath === 'string' && filePath.includes('psygil.db')) {
        calls.push('unlink:' + filePath)
      }
    })

    await wipeLocalData('PsygilCases')

    const dbWriteIdx = calls.findIndex((c) => c.startsWith('write:') && c.includes('psygil.db'))
    const dbUnlinkIdx = calls.findIndex((c) => c.startsWith('unlink:') && c.includes('psygil.db'))

    expect(dbWriteIdx).toBeGreaterThanOrEqual(0)
    expect(dbUnlinkIdx).toBeGreaterThanOrEqual(0)
    // Zero-fill must come before unlink
    expect(dbWriteIdx).toBeLessThan(dbUnlinkIdx)
  })

  it('writes a zero-filled buffer of the correct size to the database file', async () => {
    const DB_SIZE = 128
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: DB_SIZE } as fs.Stats)

    await wipeLocalData('PsygilCases')

    const dbFillCall = writeFileSyncSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).endsWith('psygil.db')
    )
    expect(dbFillCall).toBeDefined()
    const buf = dbFillCall![1] as Buffer
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBe(DB_SIZE)
    expect(buf.every((byte) => byte === 0)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Test 4: safeStorage blobs and config files are removed
  // -------------------------------------------------------------------------

  it('removes the API key encrypted file', async () => {
    await wipeLocalData('PsygilCases')
    const removedPaths = unlinkSyncSpy.mock.calls.map((c) => c[0] as string)
    expect(removedPaths.some((p) => p.includes('psygil-api-key.enc'))).toBe(true)
  })

  it('removes the refresh token file', async () => {
    await wipeLocalData('PsygilCases')
    const removedPaths = unlinkSyncSpy.mock.calls.map((c) => c[0] as string)
    expect(removedPaths.some((p) => p.includes('refresh.bin'))).toBe(true)
  })

  it('removes psygil-setup.json config file', async () => {
    await wipeLocalData('PsygilCases')
    const removedPaths = unlinkSyncSpy.mock.calls.map((c) => c[0] as string)
    expect(removedPaths.some((p) => p.includes('psygil-setup.json'))).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Test 5: Result shape
  // -------------------------------------------------------------------------

  it('returns a WipeResult with success=true and a wipeLogPath on success', async () => {
    const result = await wipeLocalData('PsygilCases')
    expect(result.success).toBe(true)
    expect(typeof result.wipeLogPath).toBe('string')
    expect(result.wipeLogPath.length).toBeGreaterThan(0)
    expect(result.wipeLogPath).toContain('wipe_log.json')
    expect(result.workspaceFolderPromptedForDelete).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Test 6: SQLite connection is closed before file destruction
  // -------------------------------------------------------------------------

  it('closes the SQLite connection before removing the database file', async () => {
    const callOrder: string[] = []
    vi.mocked(closeSqlite).mockImplementation(() => { callOrder.push('closeSqlite') })
    unlinkSyncSpy.mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p.includes('psygil.db')) {
        callOrder.push('unlinkDb')
      }
    })

    await wipeLocalData('PsygilCases')

    const closeIdx = callOrder.indexOf('closeSqlite')
    const unlinkIdx = callOrder.indexOf('unlinkDb')
    expect(closeIdx).toBeGreaterThanOrEqual(0)
    expect(unlinkIdx).toBeGreaterThanOrEqual(0)
    expect(closeIdx).toBeLessThan(unlinkIdx)
  })
})
