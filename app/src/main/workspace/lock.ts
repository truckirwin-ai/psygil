/**
 * Workspace lock file management.
 *
 * Prevents two Psygil instances from binding to the same workspace
 * directory. The lock file is a plain JSON blob with PID and an ISO
 * timestamp, stored at the workspace root as `.psygil-lock`.
 *
 * Semantics:
 *   acquireWorkspaceLock(path) tries to create the lock. If the file
 *   exists and the PID is still alive, returns {acquired: false,
 *   heldByPid, heldSince}. If the PID is dead (stale lock), the file
 *   is silently replaced and {acquired: true} returns.
 *
 *   releaseWorkspaceLock(path) removes the lock file. Always safe to
 *   call; no-op if the file is missing or not ours.
 *
 *   isWorkspaceLocked(path) returns the current lock status without
 *   modifying the file.
 *
 * This module is the workspace-level cousin of app.requestSingleInstanceLock:
 * the Electron API prevents two instances of the app itself, and this
 * module prevents two instances of the app from pointing at the same
 * workspace. The two concerns are distinct because a developer or power
 * user can launch Psygil with --workspace=... to open multiple windows.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

const LOCK_FILENAME = '.psygil-lock'

export interface WorkspaceLockInfo {
  readonly pid: number
  readonly acquiredAt: string
  readonly hostname: string
}

export interface AcquireSuccess {
  readonly acquired: true
  readonly lockPath: string
}

export interface AcquireFailure {
  readonly acquired: false
  readonly lockPath: string
  readonly heldByPid: number
  readonly heldSince: string
  readonly hostname: string
}

export type AcquireResult = AcquireSuccess | AcquireFailure

function lockPathFor(workspacePath: string): string {
  return join(workspacePath, LOCK_FILENAME)
}

/**
 * Check whether a PID is still alive. Returns true if `kill -0 pid`
 * succeeds (the process exists and we have permission to signal it),
 * false otherwise. The signal 0 does not actually send anything.
 */
function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    // ESRCH means "no such process". EPERM means the process exists but
    // we cannot signal it (other user), so treat that as "alive".
    if (err.code === 'EPERM') return true
    return false
  }
}

function readLockInfo(lockPath: string): WorkspaceLockInfo | null {
  try {
    const raw = readFileSync(lockPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<WorkspaceLockInfo>
    if (
      typeof parsed.pid !== 'number' ||
      typeof parsed.acquiredAt !== 'string' ||
      typeof parsed.hostname !== 'string'
    ) {
      return null
    }
    return {
      pid: parsed.pid,
      acquiredAt: parsed.acquiredAt,
      hostname: parsed.hostname,
    }
  } catch {
    return null
  }
}

/**
 * Attempt to acquire the workspace lock. If the file exists but the
 * holding process is dead, the stale lock is replaced.
 */
export function acquireWorkspaceLock(workspacePath: string): AcquireResult {
  const lockPath = lockPathFor(workspacePath)

  if (existsSync(lockPath)) {
    const info = readLockInfo(lockPath)
    if (info !== null && isPidAlive(info.pid) && info.pid !== process.pid) {
      return {
        acquired: false,
        lockPath,
        heldByPid: info.pid,
        heldSince: info.acquiredAt,
        hostname: info.hostname,
      }
    }
    // Stale or malformed lock: remove it and proceed to acquire.
    try {
      unlinkSync(lockPath)
    } catch (e) {
      process.stderr.write(
        `[workspace-lock] Could not remove stale lock at ${lockPath}: ${(e as Error).message}\n`,
      )
    }
  }

  const info: WorkspaceLockInfo = {
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    hostname: process.env.HOSTNAME ?? process.env.COMPUTERNAME ?? 'unknown',
  }

  try {
    writeFileSync(lockPath, JSON.stringify(info, null, 2), { flag: 'wx' })
  } catch (e) {
    // EEXIST means another process acquired the lock between our check
    // and write. Treat as lock failure and surface the holder.
    const err = e as NodeJS.ErrnoException
    if (err.code === 'EEXIST') {
      const race = readLockInfo(lockPath)
      return {
        acquired: false,
        lockPath,
        heldByPid: race?.pid ?? -1,
        heldSince: race?.acquiredAt ?? new Date().toISOString(),
        hostname: race?.hostname ?? 'unknown',
      }
    }
    throw e
  }

  return { acquired: true, lockPath }
}

/**
 * Release the workspace lock if it is held by this process.
 * No-op if the file does not exist or is held by another process.
 */
export function releaseWorkspaceLock(workspacePath: string): void {
  const lockPath = lockPathFor(workspacePath)
  if (!existsSync(lockPath)) return

  const info = readLockInfo(lockPath)
  if (info !== null && info.pid !== process.pid) {
    // Someone else owns it now; do not remove.
    return
  }

  try {
    unlinkSync(lockPath)
  } catch (e) {
    process.stderr.write(
      `[workspace-lock] Could not release lock at ${lockPath}: ${(e as Error).message}\n`,
    )
  }
}

/**
 * Inspect the current lock state without modifying it. Useful for UI
 * "Another Psygil instance is using this workspace" messages.
 */
export function inspectWorkspaceLock(workspacePath: string): WorkspaceLockInfo | null {
  const lockPath = lockPathFor(workspacePath)
  if (!existsSync(lockPath)) return null
  return readLockInfo(lockPath)
}
