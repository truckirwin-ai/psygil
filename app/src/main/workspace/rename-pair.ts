// Phase C.4: Rename pairing logic for chokidar watcher.
//
// chokidar fires separate unlink + add events for file renames (no native
// rename event on macOS/Windows). This module pairs those events into a
// single rename action so the DB row is updated in place rather than
// deleted and re-inserted, which would produce duplicate rows when a UNIQUE
// index is present.
//
// Pairing rule: if unlink(A) and add(B) both arrive within PAIR_WINDOW_MS
// and basename(A) === basename(B), they are treated as a rename from A to B.
//
// Public API:
//   renamePair.recordUnlink(path)
//   renamePair.recordAdd(path) -> returns the unlink path if paired, else null
//   renamePair.flush()         -> returns unpaired unlinks that timed out

import { basename } from 'path'

/** Time window in ms within which unlink+add are considered a rename pair. */
export const PAIR_WINDOW_MS = 100

interface PendingUnlink {
  readonly filePath: string
  readonly ts: number
}

/**
 * Creates an isolated rename-pair tracker.
 * A single tracker instance is expected per watcher.
 */
export function createRenamePairTracker(): RenamePairTracker {
  // Key: basename of the file. Value: unlink event details.
  const pending = new Map<string, PendingUnlink>()

  return {
    recordUnlink(filePath: string): void {
      pending.set(basename(filePath), { filePath, ts: Date.now() })
    },

    recordAdd(filePath: string): string | null {
      const key = basename(filePath)
      const unlink = pending.get(key)
      if (unlink === undefined) return null

      const age = Date.now() - unlink.ts
      if (age > PAIR_WINDOW_MS) {
        // Window expired: treat as separate events
        pending.delete(key)
        return null
      }

      pending.delete(key)
      return unlink.filePath
    },

    flush(): readonly string[] {
      const now = Date.now()
      const expired: string[] = []
      for (const [key, entry] of pending.entries()) {
        if (now - entry.ts > PAIR_WINDOW_MS) {
          expired.push(entry.filePath)
          pending.delete(key)
        }
      }
      return expired
    },
  }
}

export interface RenamePairTracker {
  /** Record a file-removed event. */
  recordUnlink(filePath: string): void

  /**
   * Record a file-added event.
   * Returns the original (unlink) path if this add is paired with a prior
   * unlink of the same basename within the window, otherwise null.
   */
  recordAdd(filePath: string): string | null

  /**
   * Returns any unlink paths whose pairing window has expired without a
   * matching add. Removes them from the pending set.
   */
  flush(): readonly string[]
}
