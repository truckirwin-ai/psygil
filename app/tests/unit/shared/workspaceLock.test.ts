import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

// The global setup (src/main/__tests__/setup.ts) mocks some fs methods but
// not writeFileSync. Stub it here so the lock writer does not touch disk.
vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined)

import {
  acquireWorkspaceLock,
  releaseWorkspaceLock,
  inspectWorkspaceLock,
} from '../../../src/main/workspace/lock'

describe('acquireWorkspaceLock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('acquires when no lock file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const result = acquireWorkspaceLock('/tmp/ws')
    expect(result.acquired).toBe(true)
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it('refuses when an alive PID holds the lock', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const info = { pid: 99999999, acquiredAt: '2026-04-16T00:00:00Z', hostname: 'test' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(info))
    // Mock process.kill to simulate alive PID (no throw)
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    const result = acquireWorkspaceLock('/tmp/ws')
    expect(result.acquired).toBe(false)
    if (!result.acquired) {
      expect(result.heldByPid).toBe(99999999)
      expect(result.hostname).toBe('test')
    }

    killSpy.mockRestore()
  })

  it('recovers a stale lock when the holder PID is dead', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const info = { pid: 12345, acquiredAt: '2026-04-16T00:00:00Z', hostname: 'dead' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(info))
    // Mock process.kill to throw ESRCH (process not found)
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      const e = new Error('kill ESRCH') as NodeJS.ErrnoException
      e.code = 'ESRCH'
      throw e
    })

    const result = acquireWorkspaceLock('/tmp/ws')
    expect(result.acquired).toBe(true)
    // Should have removed the stale file before writing a new one
    expect(fs.unlinkSync).toHaveBeenCalled()
    expect(fs.writeFileSync).toHaveBeenCalled()

    killSpy.mockRestore()
  })

  it('treats our own PID in the lock as acquirable', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const info = { pid: process.pid, acquiredAt: '2026-04-16T00:00:00Z', hostname: 'self' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(info))

    const result = acquireWorkspaceLock('/tmp/ws')
    expect(result.acquired).toBe(true)
  })

  it('inspectWorkspaceLock returns null when file missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    expect(inspectWorkspaceLock('/tmp/ws')).toBeNull()
  })

  it('inspectWorkspaceLock returns parsed info when present', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const info = { pid: 42, acquiredAt: '2026-04-16T00:00:00Z', hostname: 'host' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(info))
    expect(inspectWorkspaceLock('/tmp/ws')).toEqual(info)
  })
})

describe('releaseWorkspaceLock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is a no-op when the lock file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    releaseWorkspaceLock('/tmp/ws')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('removes the lock if we own it', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const info = { pid: process.pid, acquiredAt: '2026-04-16T00:00:00Z', hostname: 'self' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(info))
    releaseWorkspaceLock('/tmp/ws')
    expect(fs.unlinkSync).toHaveBeenCalled()
  })

  it('leaves the lock alone if another PID owns it', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const info = { pid: process.pid + 1, acquiredAt: '2026-04-16T00:00:00Z', hostname: 'other' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(info))
    releaseWorkspaceLock('/tmp/ws')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })
})
