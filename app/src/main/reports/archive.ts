/**
 * Draft archival helpers for the publish pipeline.
 *
 * When a case advances from review to complete, every draft DOCX is moved
 * from report/drafts/ into report/archive/ so the drafts folder only holds
 * work-in-progress versions. Final sealed files live under report/final/.
 *
 * Read-only bit management is also exposed here so the publish pipeline
 * can freeze the final files at chmod 0444 (POSIX) after sealing.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  chmodSync,
} from 'fs'
import { join } from 'path'

export interface ArchiveResult {
  readonly movedCount: number
  readonly archiveDir: string
}

/**
 * Move every draft_v*.docx from `draftsDir` into `archiveDir`.
 * Creates `archiveDir` if it does not exist. Safe to call when drafts
 * are absent; returns {movedCount: 0}.
 */
export function archiveDrafts(draftsDir: string, archiveDir: string): ArchiveResult {
  if (!existsSync(draftsDir)) {
    return { movedCount: 0, archiveDir }
  }

  mkdirSync(archiveDir, { recursive: true })

  const files = readdirSync(draftsDir)
  const drafts = files.filter((f) => /^draft_v\d+\.docx$/i.test(f))

  let moved = 0
  for (const file of drafts) {
    const from = join(draftsDir, file)
    const to = join(archiveDir, file)
    try {
      renameSync(from, to)
      moved += 1
    } catch (e) {
      process.stderr.write(
        `[reports:archive] Failed to move ${file}: ${(e as Error).message}\n`,
      )
    }
  }

  return { movedCount: moved, archiveDir }
}

/**
 * Set a file to read-only. Idempotent; safe to call on files that are
 * already read-only. On POSIX systems chmod 0444; on Windows relies on
 * the caller to use fs.chmodSync with a readonly flag (0444 maps to the
 * readonly attribute through libuv).
 */
export function setReadOnly(filePath: string): void {
  try {
    chmodSync(filePath, 0o444)
  } catch (e) {
    process.stderr.write(
      `[reports:archive] Failed to set read-only on ${filePath}: ${(e as Error).message}\n`,
    )
  }
}

/**
 * Restore read-write on a file (chmod 0644). Used only by the supervisor
 * unlock path; do not call from the normal publish flow.
 */
export function setReadWrite(filePath: string): void {
  try {
    chmodSync(filePath, 0o644)
  } catch (e) {
    process.stderr.write(
      `[reports:archive] Failed to restore read-write on ${filePath}: ${(e as Error).message}\n`,
    )
  }
}
