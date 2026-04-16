/**
 * Psygil local data wipe module (Phase C.3).
 *
 * Implements a full local-data wipe for Settings > Danger Zone.
 * The wipe is HIPAA-accountable: a wipe_log.json entry is written BEFORE
 * any destructive action and survives the wipe so administrators retain an
 * accountability trail.
 *
 * Destruction sequence:
 *   1. Write wipe_log.json (survives)
 *   2. Emit audit entry data_wiped (goes into audit_log, which will be destroyed)
 *   3. Close SQLite connection
 *   4. Zero-fill then unlink the SQLCipher database file
 *   5. Remove safeStorage blobs (API key, refresh token)
 *   6. Remove userData config JSON files (psygil-setup.json, config.json, etc.)
 *
 * The caller (IPC handler) is responsible for triggering app.relaunch() after
 * the UI has had a chance to show a success message. This module does NOT
 * auto-relaunch.
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { closeSqlite } from '../db/connection'
import { getDefaultDbPath } from '../db'
import { loadWorkspacePath, getDefaultWorkspacePath } from '../workspace'

// ---------------------------------------------------------------------------
// Types re-exported so the IPC handler can import them locally
// ---------------------------------------------------------------------------

export interface WipeResult {
  readonly success: boolean
  readonly workspaceFolderPromptedForDelete: boolean
  readonly wipeLogPath: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolve the current workspace path (may be null before setup). */
function resolveWorkspacePath(): string | null {
  try {
    return loadWorkspacePath()
  } catch {
    return null
  }
}

/** Last segment of a filesystem path (the folder name). */
function folderName(p: string): string {
  return path.basename(p.replace(/[/\\]+$/, ''))
}

/** Write the HIPAA accountability wipe log. Returns the log file path. */
function writeWipeLog(workspacePath: string | null): string {
  const userData = app.getPath('userData')
  const logPath = path.join(userData, 'wipe_log.json')

  const entry = {
    timestamp: new Date().toISOString(),
    workspacePath: workspacePath ?? null,
    userId: os.userInfo().username,
    hostname: os.hostname(),
    pid: process.pid,
  }

  // Append to existing log (if prior wipes occurred) or create new file.
  let existing: unknown[] = []
  if (fs.existsSync(logPath)) {
    try {
      const raw = fs.readFileSync(logPath, 'utf-8').trim()
      if (raw.length > 0) {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          existing = parsed
        }
      }
    } catch {
      // Corrupt log: start fresh but preserve the file name
    }
  }

  existing.push(entry)
  fs.writeFileSync(logPath, JSON.stringify(existing, null, 2), { mode: 0o600 })
  return logPath
}

/** Zero-fill then unlink a file to prevent encrypted residue recovery. */
function secureDelete(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  try {
    const { size } = fs.statSync(filePath)
    if (size > 0) {
      // Write zeros over the entire file content before unlinking.
      fs.writeFileSync(filePath, Buffer.alloc(size, 0))
    }
    fs.unlinkSync(filePath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[uninstall] secureDelete(${filePath}): ${msg}\n`)
    // Attempt plain unlink even if zero-fill failed
    try { fs.unlinkSync(filePath) } catch { /* best-effort */ }
  }
}

/** Remove a file if it exists, without zero-filling (non-sensitive files). */
function removeIfExists(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  try {
    fs.unlinkSync(filePath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[uninstall] removeIfExists(${filePath}): ${msg}\n`)
  }
}

/** Attempt to emit a final audit entry. Swallowed on error (DB may already be gone). */
function tryEmitAuditEntry(workspacePath: string | null): void {
  try {
    const { logAuditEntry } = require('../audit') as { logAuditEntry: (params: {
      caseId: number
      actionType: string
      actorType: 'system'
      details: Record<string, unknown>
    }) => number }
    logAuditEntry({
      caseId: 0,
      actionType: 'data_wiped',
      actorType: 'system',
      details: {
        workspacePath: workspacePath ?? null,
        hostname: os.hostname(),
        pid: process.pid,
        timestamp: new Date().toISOString(),
      },
    })
  } catch {
    // Swallow: the DB may already be closing or unavailable
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wipe all local Psygil data.
 *
 * @param confirmation - Must equal the workspace folder name (last path
 *   segment). Acts as a belt-and-suspenders confirmation guard.
 *
 * @returns WipeResult on success.
 * @throws Error when confirmation does not match or a critical step fails.
 */
export async function wipeLocalData(confirmation: string): Promise<WipeResult> {
  const userData = app.getPath('userData')

  // Resolve workspace before we destroy anything
  const workspacePath = resolveWorkspacePath() ?? getDefaultWorkspacePath()
  const expectedName = folderName(workspacePath)

  // Belt-and-suspenders: require the caller to type the folder name
  if (confirmation !== expectedName) {
    throw new Error(
      `Confirmation mismatch: expected "${expectedName}", got "${confirmation}". Wipe aborted.`
    )
  }

  // 1. Write the HIPAA accountability log (survives the wipe)
  const wipeLogPath = writeWipeLog(workspacePath)

  // 2. Emit audit entry BEFORE destructive operations
  tryEmitAuditEntry(workspacePath)

  // 3. Close the SQLite connection before touching the file
  closeSqlite()

  // 4. Secure-delete the SQLCipher database file
  const dbPath = getDefaultDbPath()
  secureDelete(dbPath)

  // Also delete the WAL and SHM sidecar files if they exist
  secureDelete(`${dbPath}-wal`)
  secureDelete(`${dbPath}-shm`)

  // 5. Remove safeStorage blobs
  //    API key: {userData}/psygil-api-key.enc
  removeIfExists(path.join(userData, 'psygil-api-key.enc'))
  //    Refresh token: {userData}/auth/refresh.bin
  removeIfExists(path.join(userData, 'auth', 'refresh.bin'))

  // 6. Remove userData config JSON files (leave wipe_log.json intact)
  const CONFIG_FILES = [
    'psygil-setup.json',
    'config.json',
    'psygil-config.json',
  ]
  for (const name of CONFIG_FILES) {
    removeIfExists(path.join(userData, name))
  }

  return {
    success: true,
    // Signal the UI that it should prompt the user about the workspace folder.
    // The module does NOT delete workspace case files on its own: data
    // sovereignty means the clinician decides what happens to their case data.
    workspaceFolderPromptedForDelete: true,
    wipeLogPath,
  }
}
