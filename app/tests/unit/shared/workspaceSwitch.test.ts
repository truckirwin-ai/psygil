import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

// Mock writeFileSync so acquireWorkspaceLock does not touch real disk.
vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined)

import {
  acquireWorkspaceLock,
  releaseWorkspaceLock,
  inspectWorkspaceLock,
} from '../../../src/main/workspace/lock'

// These tests cover the pure lock interactions that workspace:switch uses.
// The handler itself is tested end-to-end in the walkthrough harness.
describe('workspace switch lock semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('switching to a workspace held by a live foreign PID is blocked', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const info = { pid: 99999, acquiredAt: '2026-04-16T00:00:00Z', hostname: 'other' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(info))
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    // The handler uses inspectWorkspaceLock() to probe before mutating state.
    const probe = inspectWorkspaceLock('/tmp/other-ws')
    expect(probe).not.toBeNull()
    expect(probe?.pid).toBe(99999)

    // Acquire still reports failure in that scenario.
    const result = acquireWorkspaceLock('/tmp/other-ws')
    expect(result.acquired).toBe(false)

    killSpy.mockRestore()
  })

  it('switching to an empty target succeeds after releasing the old one', () => {
    // 1. First probe says nothing held at the new path.
    vi.mocked(fs.existsSync).mockReturnValue(false)
    expect(inspectWorkspaceLock('/tmp/new-ws')).toBeNull()

    // 2. Release the old lock (no-op when file missing).
    releaseWorkspaceLock('/tmp/old-ws')
    expect(fs.unlinkSync).not.toHaveBeenCalled()

    // 3. Acquire the new lock.
    const result = acquireWorkspaceLock('/tmp/new-ws')
    expect(result.acquired).toBe(true)
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it('switching from and to the same path is a no-op on ownership', () => {
    // Own lock already held by our PID.
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const info = { pid: process.pid, acquiredAt: '2026-04-16T00:00:00Z', hostname: 'self' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(info))

    // Inspect reports our own ownership.
    const probe = inspectWorkspaceLock('/tmp/same-ws')
    expect(probe?.pid).toBe(process.pid)

    // Acquire is idempotent (our own PID is treated as acquirable).
    const result = acquireWorkspaceLock('/tmp/same-ws')
    expect(result.acquired).toBe(true)
  })
})
